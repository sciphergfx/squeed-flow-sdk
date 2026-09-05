import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import ts from "typescript";

const sourceRoot = process.argv[2];
assert.ok(sourceRoot, "Pass the backflow-admin/src/pages/workflows directory");
const output = dirname(fileURLToPath(import.meta.url));
const typesText = await readFile(join(sourceRoot, "types.ts"), "utf8");
const typesFile = ts.createSourceFile(
  "types.ts",
  typesText,
  ts.ScriptTarget.Latest,
  true,
);
const declarations = typesFile.statements.filter(
  (statement) =>
    ts.isInterfaceDeclaration(statement) &&
    ["WorkflowStep", "WorkflowForm"].includes(statement.name.text),
);
assert.equal(declarations.length, 2);
const constants = await build({
  entryPoints: [join(sourceRoot, "constants.ts")],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  define: { "import.meta.env": "{}" },
});
const { STEP_CONFIG_SCHEMAS, STEP_TYPES, DEFAULT_WORKFLOW } = await import(
  `data:text/javascript;base64,${Buffer.from(constants.outputFiles[0].contents).toString("base64")}`
);
const typeName = (name) =>
  name
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("") + "Config";
const fieldType = (field) =>
  ({
    number: "number",
    boolean: "boolean",
    select: "string",
    multiselect: "string[]",
    keyvalue: "Record<string, any>",
    "filter-builder": "any",
    string: "any",
    textarea: "any",
  })[field.type];
const extraWorkflowFields = {
  input: "Record<string, any>",
  cronExpression: "string",
  eventName: "string",
  eventFilter: "Record<string, any>",
  onError:
    "{ notify?: boolean; retry?: { maxAttempts?: number; delayMs?: number } }",
  agent: "any",
  context: "any",
  subscribable: "boolean",
  channel: "string",
  working_directory: "string",
  localMcpEndpoint: "string",
  monitoring: "any",
};
const interfaces = declarations.map((declaration) => {
  let text = declaration.getText(typesFile).replace(/^export /, "");
  if (declaration.name.text === "WorkflowForm")
    text =
      text.slice(0, -1) +
      Object.entries(extraWorkflowFields)
        .map(([name, type]) => `  ${name}?: ${type};`)
        .join("\n") +
      "\n}";
  return text;
});
const schemas = Object.entries(STEP_CONFIG_SCHEMAS);
for (const [name, fields] of schemas) {
  assert.equal(
    new Set(fields.map((field) => field.name)).size,
    fields.length,
    `${name}: duplicate fields`,
  );
  interfaces.push(
    `interface ${typeName(name)} {\n${fields.map((field) => `  ${JSON.stringify(field.name)}${field.required && !field.showWhen ? "" : "?"}: ${fieldType(field)};`).join("\n")}\n}`,
  );
}
const configNames = [
  ...new Set([...schemas.map(([name]) => name), ...STEP_TYPES]),
];
for (const name of configNames)
  if (!STEP_CONFIG_SCHEMAS[name])
    interfaces.push(`interface ${typeName(name)} { [key: string]: any }`);
const graphFields = {
  workflow: "WorkflowForm",
  step: "WorkflowStep",
  ...Object.fromEntries(configNames.map((name) => [name, typeName(name)])),
};
const full =
  [
    ...interfaces,
    `interface Graph {\n${Object.entries(graphFields)
      .map(([name, type]) => `  ${JSON.stringify(name)}: ${type};`)
      .join("\n")}\n}`,
  ].join("\n\n") + "\n";
const fullFile = ts.createSourceFile(
  "full-interface.ts",
  full,
  ts.ScriptTarget.Latest,
  true,
);
const omitted = [];
const projectType = (node, path) => {
  if (
    [
      ts.SyntaxKind.StringKeyword,
      ts.SyntaxKind.NumberKeyword,
      ts.SyntaxKind.BooleanKeyword,
    ].includes(node.kind) ||
    ts.isLiteralTypeNode(node)
  )
    return node.getText(fullFile);
  if (ts.isTypeReferenceNode(node) && !node.typeArguments?.length)
    return node.getText(fullFile);
  if (ts.isArrayTypeNode(node)) {
    const item = projectType(node.elementType, path + "[]");
    return item ? `${item}[]` : undefined;
  }
  if (ts.isUnionTypeNode(node)) {
    const members = node.types.map((member) => projectType(member, path));
    return members.every(Boolean) ? members.join(" | ") : undefined;
  }
  if (ts.isTypeLiteralNode(node))
    return `{ ${projectMembers(node.members, path).join(" ")} }`;
  return undefined;
};
const projectMembers = (members, owner) =>
  members.flatMap((member) => {
    const name =
      member.name &&
      (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))
        ? member.name.text
        : "[index]";
    const path = `${owner}.${name}`;
    const type =
      ts.isPropertySignature(member) && member.type
        ? projectType(member.type, path)
        : undefined;
    if (!type) {
      omitted.push({ path, original: member.getText(fullFile) });
      return [];
    }
    return [
      `${JSON.stringify(name)}${member.questionToken ? "?" : ""}: ${type};`,
    ];
  });
const supportedDeclarations = fullFile.statements
  .filter(ts.isInterfaceDeclaration)
  .map(
    (declaration) =>
      `interface ${declaration.name.text} {\n  ${projectMembers(declaration.members, declaration.name.text).join("\n  ")}\n}`,
  );
const probes = `interface ValidationSamples {
  text: string; count: number; flag: boolean; names: string[]; counts: number[];
  target: "local"; invalidTarget: "remote"; broadTarget: string;
  retry: { maxAttempts: number; backoffMs: number; backoffMultiplier: number };
  badRetry: { maxAttempts: string };
  approval: { requireApproval: boolean; resourceAction: { type: "oauth_connect"; resourceType: string; resourceName: string; scopes: string[] } };
  badApproval: { resourceAction: { type: "oauth_connect"; resourceType: string } };
}`;
const supported =
  supportedDeclarations
    .join("\n\n")
    .replace(
      /interface Graph \{/,
      "interface Graph {\n  samples: ValidationSamples;",
    ) +
  "\n\n" +
  probes +
  "\n";
const manifest = {
  sources: [
    "Workflows.tsx",
    "workflows/types.ts",
    "workflows/constants.ts",
    "workflows/workflow-editor-modal.tsx",
    "workflows/workflow-workflow-tab.tsx",
    "workflows/step-config-forms.tsx",
  ],
  notes: [
    "Full snapshot preserves any/index signatures from source types.",
    "Text controls JSON.parse when possible, so string/textarea fields are any, not fabricated string-only contracts.",
    "Select controls accept advanced values, so their type is string; options remain in this manifest.",
    "Conditionally required fields are optional in the merged interface; showWhen is preserved here, not enforced by structural validation.",
    "Dynamic tool params/custom step config cannot be enumerated without runtime schemas.",
    "Supported projection explicitly omits unsupported members; it is not full-form validation.",
  ],
  enabledStepTypes: STEP_TYPES,
  schemaCount: schemas.length,
  fieldCount: schemas.reduce((count, [, fields]) => count + fields.length, 0),
  workflowDefaults: DEFAULT_WORKFLOW,
  fields: STEP_CONFIG_SCHEMAS,
  omitted,
};
await writeFile(join(output, "full-interface.ts"), full);
await writeFile(join(output, "supported-interface.ts"), supported);
await writeFile(
  join(output, "coverage.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      schemas: manifest.schemaCount,
      fields: manifest.fieldCount,
      enabledStepTypes: STEP_TYPES.length,
      omittedMembers: omitted.length,
      output,
    },
    null,
    2,
  ),
);
