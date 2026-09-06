import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createConfigCatalog, materializeStepConfigs } from "../examples/workflow-form/catalog";
import coverage from "../examples/workflow-form/coverage.json";

test("resolved reusable configs match the production editor normalizer for every enabled step", {
  skip: !process.env.BACKFLOW_WORKFLOW_SOURCE,
}, async () => {
  const { build } = createRequire(join(process.cwd(), "package.json"))("esbuild") as typeof import("esbuild");
  const compiled = await build({
    entryPoints: [join(process.env.BACKFLOW_WORKFLOW_SOURCE!, "step-transforms.ts")],
    bundle: true, platform: "node", format: "esm", write: false,
  });
  const { normalizeStepForExecution } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);
  const { state } = createConfigCatalog();
  for (const type of coverage.enabledStepTypes) {
    const fields = (coverage.fields as Record<string, { name: string; type: string; defaultValue?: unknown; options?: unknown[] }[]>)[type] ?? [];
    state.configs[type].config = Object.fromEntries(fields.map(field => [field.name, field.defaultValue ?? (
      field.type === "boolean" ? false : field.type === "number" ? 3 : field.type === "multiselect" ? ["shared"]
        : field.type === "keyvalue" || field.type === "filter-builder" ? { sample: "value" }
          : "{{input.value}}"
    )]));
    state.configs[type].config.extraPreserved = { nested: false };
  }
  const original = structuredClone(state);
  const materialized = materializeStepConfigs(state);
  for (const step of materialized.steps) {
    const input = state.steps.find(entry => entry.id === step.id)!;
    const { configRef, ...metadata } = input;
    const expected = normalizeStepForExecution({ ...metadata, config: structuredClone(state.configs[configRef].config) });
    assert.deepEqual(normalizeStepForExecution(step), expected, step.type);
  }
  assert.deepEqual(state, original);
});