import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  parseTypeScriptContract,
  connectionIssue,
  compileSqueed,
} from "../../dist/index.js";

const directory = dirname(fileURLToPath(import.meta.url));
const full = await readFile(join(directory, "full-interface.ts"), "utf8");
const projected = await readFile(
  join(directory, "supported-interface.ts"),
  "utf8",
);
let fullUploadError;
try {
  await parseTypeScriptContract(full, "full-interface.ts");
} catch (error) {
  fullUploadError = error.message;
}
assert.match(fullUploadError, /Unsupported TypeScript type: any/);
const contract = await parseTypeScriptContract(
  projected,
  "supported-interface.ts",
);
const cases = [
  ["number", "samples", "count", "workflow", "timeoutMs", "valid"],
  ["number mismatch", "samples", "text", "workflow", "timeoutMs", "invalid"],
  ["string array", "samples", "names", "workflow", "tags", "valid"],
  ["array mismatch", "samples", "counts", "workflow", "tags", "invalid"],
  ["literal union", "samples", "target", "step", "executionTarget", "valid"],
  [
    "invalid literal",
    "samples",
    "invalidTarget",
    "step",
    "executionTarget",
    "invalid",
  ],
  [
    "wide string to literal",
    "samples",
    "broadTarget",
    "step",
    "executionTarget",
    "invalid",
  ],
  ["nested retry", "samples", "retry", "step", "retry", "valid"],
  ["nested retry mismatch", "samples", "badRetry", "step", "retry", "invalid"],
  ["nested approval", "samples", "approval", "step", "pausePoint", "valid"],
  [
    "missing nested required field",
    "samples",
    "badApproval",
    "step",
    "pausePoint",
    "invalid",
  ],
  ["optional to required", "step", "id", "workflow", "name", "invalid"],
  ["optional to optional", "step", "id", "workflow", "id", "valid"],
  ["boolean", "samples", "flag", "llm", "streamPreview", "valid"],
  ["boolean mismatch", "samples", "text", "llm", "streamPreview", "invalid"],
  ["HTTP timeout", "samples", "count", "http", "timeout", "valid"],
  ["untyped text field", "samples", "text", "http", "url", "unverified"],
].map(
  (
    [label, source, sourceProperty, target, targetProperty, expected],
    index,
  ) => ({
    id: `case-${index + 1}`,
    label,
    source: `root.${source}`,
    sourceProperty,
    target: `root.${target}`,
    targetProperty,
    expected,
  }),
);
const declarations = new Map();
for (const source of [full, projected]) {
  const file = ts.createSourceFile(
    "contract.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  for (const statement of file.statements)
    if (
      ts.isInterfaceDeclaration(statement) &&
      !declarations.has(statement.name.text)
    )
      declarations.set(statement.name.text, { statement, file });
}
const graph = {};
const graphDeclaration = ts
  .createSourceFile("projected.ts", projected, ts.ScriptTarget.Latest, true)
  .statements.find(
    (statement) =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === "Graph",
  );
for (const member of graphDeclaration.members) {
  const name = member.name.text;
  const { statement, file } = declarations.get(member.type.typeName.text);
  graph[name] = Object.fromEntries(
    statement.members
      .filter(ts.isPropertySignature)
      .map((property) => [
        property.name.text,
        property.type.getText(file).replace(/\s+/g, " "),
      ]),
  );
  if (!Object.keys(graph[name]).length)
    graph[name].untypedConfig = "Dynamic config: no static property schema";
}
const results = cases.map((edge) => {
  const reason = connectionIssue(contract, edge);
  const actual = reason?.startsWith("Unverified:")
    ? "unverified"
    : reason
      ? "invalid"
      : "valid";
  assert.equal(actual, edge.expected, edge.label);
  const node = graph[edge.source.slice(5)];
  (node.$connections ??= []).push({
    id: edge.id,
    target: edge.target,
    sourceProperty: edge.sourceProperty,
    targetProperty: edge.targetProperty,
  });
  return { ...edge, actual, reason };
});
const compiled = compileSqueed(graph);
assert.equal(
  compiled.edges.filter((edge) => edge.data.connection).length,
  cases.length,
);
const totals = Object.fromEntries(
  ["valid", "invalid", "unverified"].map((status) => [
    status,
    results.filter((result) => result.actual === status).length,
  ]),
);
await writeFile(
  join(directory, "graph.json"),
  JSON.stringify(graph, null, 2) + "\n",
);
await writeFile(
  join(directory, "results.json"),
  JSON.stringify({ fullUploadError, totals, cases: results }, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      fullUploadError,
      graphNodes: compiled.nodes.length,
      mappings: cases.length,
      totals,
    },
    null,
    2,
  ),
);
