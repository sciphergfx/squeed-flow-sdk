import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { readFormSchema } from "../../dist/index.js";

const sourceRoot = process.argv[2];
assert.ok(sourceRoot, "Pass the backflow-admin/src/pages/workflows directory");
const parity = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("./extract.mjs", import.meta.url)),
    sourceRoot,
    "--check",
  ],
  { encoding: "utf8" },
);
const sourceParity = parity.status === 0;
const coverage = JSON.parse(
  await readFile(new URL("./coverage.json", import.meta.url), "utf8"),
);
const compiled = await build({
  entryPoints: [fileURLToPath(new URL("./catalog.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { CONFIG_CATALOG, configTypeName } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`
);
const source = await readFile(
  new URL("./full-interface.ts", import.meta.url),
  "utf8",
);
const names = Object.keys(coverage.fields).map(configTypeName);
const schema = await readFormSchema(
  { name: "full-interface.ts", size: source.length, text: async () => source },
  names,
);
const fields = Object.entries(coverage.fields).map(([type, definitions]) => ({
  type,
  declared: definitions.length,
  retained: definitions.filter((field) =>
    Object.prototype.hasOwnProperty.call(
      schema[configTypeName(type)].properties,
      field.name,
    ),
  ).length,
  enabled: coverage.enabledStepTypes.includes(type),
  reusableConfigNode: !!CONFIG_CATALOG.bindings[`root.config_${type}`],
}));
const missingNodes = coverage.enabledStepTypes.filter(
  (type) => !CONFIG_CATALOG.bindings[`root.config_${type}`],
);
const missingFields = fields.filter(
  (entry) => entry.declared !== entry.retained,
);
const dynamicOptions = Object.entries(coverage.fields).flatMap(
  ([type, definitions]) =>
    definitions
      .filter((field) => field.fetchOptions)
      .map((field) => `${type}.${field.name}`),
);
const blockers = [
  ...(!sourceParity
    ? ["Generated workflow interfaces do not match current editor source."]
    : []),
  ...(missingFields.length
    ? ["Some editor configuration fields are missing from form schemas."]
    : []),
  ...(missingNodes.length
    ? ["Some enabled steps lack reusable configuration nodes."]
    : []),
  "SDK catalog is not integrated into the production Workflows editor save/load path.",
  "Tenant-scoped option adapters, provider/model selectors, and dynamic tool schemas are not connected in the catalog.",
  "Standalone workflow-state model, tool and text references still need production resource resolution; configRef materialization only covers catalog configs.",
  "Step/workflow execution metadata, backend validation, migration round trips and authorization need production integration tests.",
  "The complete release gate and staged deployment acceptance have not passed for this integration.",
];
console.log(
  JSON.stringify(
    {
      sourceParity,
      enabledStepTypes: coverage.enabledStepTypes.length,
      schemaDefinitions: coverage.schemaCount,
      declaredConfigFields: coverage.fieldCount,
      retainedFormFields: fields.reduce(
        (total, entry) => total + entry.retained,
        0,
      ),
      missingNodes,
      missingFields,
      dynamicOptions,
      deploymentReady: false,
      blockers,
      fields,
    },
    null,
    2,
  ),
);
if (
  !sourceParity ||
  missingNodes.length ||
  missingFields.length ||
  process.argv.includes("--require-deployable")
)
  process.exitCode = 1;
