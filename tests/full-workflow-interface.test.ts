import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  readFormSchema,
  formValueError,
  conditionMatches,
} from "../src/core/forms";
import {
  createConfigCatalog,
  materializeStepConfigs,
} from "../examples/workflow-form/catalog";
import { compileSqueed } from "../src/core/squeedEdits";
import { resolveStateView } from "../src/utils/formState";
import {
  connectionIssue,
  parseTypeScriptContract,
} from "../src/core/workflowContract";

test("full editor interfaces retain every declared config field in form schemas", async () => {
  const source = readFileSync(
    "examples/workflow-form/full-interface.ts",
    "utf8",
  );
  const coverage = JSON.parse(
    readFileSync("examples/workflow-form/coverage.json", "utf8"),
  );
  const typeName = (name: string) =>
    name
      .split("_")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join("") + "Config";
  const names = [
    "WorkflowForm",
    "WorkflowStep",
    ...Object.keys(coverage.fields).map(typeName),
    "CustomConfig",
  ];
  const schema = await readFormSchema(
    {
      name: "full-interface.ts",
      size: source.length,
      text: async () => source,
    },
    names,
  );
  for (const [step, fields] of Object.entries(coverage.fields)) {
    assert.deepEqual(
      Object.keys(schema[typeName(step)].properties),
      (fields as { name: string }[]).map((field) => field.name),
      step,
    );
  }
  assert.equal(schema.LlmConfig.properties.prompt.type.kind, "json");
  assert.deepEqual(schema.HttpConfig.properties.headers.type, {
    kind: "object",
    properties: {},
    additionalProperties: { kind: "json" },
  });
  assert.deepEqual(schema.CustomConfig.additionalProperties, { kind: "json" });
  assert.equal(schema.WorkflowStep.properties.config.type.kind, "object");
  await assert.rejects(
    parseTypeScriptContract(source, "full-interface.ts"),
    /Unsupported TypeScript type: any/,
  );
  assert.match(
    connectionIssue(
      {
        name: "forms",
        nodes: {
          source: { type: schema.HttpConfig, optional: false },
          target: { type: schema.HttpConfig, optional: false },
        },
      },
      {
        id: "edge",
        source: "source",
        target: "target",
        sourceProperty: "headers",
        targetProperty: "headers",
      },
    )!,
    /^Unverified:/,
  );
});

test("JSON form values reject non-JSON data and typed dictionaries validate entries", () => {
  for (const value of [
    null,
    true,
    12,
    "text",
    [],
    { nested: [{ value: false }] },
  ])
    assert.equal(formValueError({ kind: "json" }, value, true), undefined);
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const value of [
    NaN,
    Infinity,
    () => {},
    new Date(),
    { value: undefined },
    cycle,
  ])
    assert.equal(
      formValueError({ kind: "json" }, value, true),
      "Expected a JSON value",
    );
  assert.equal(formValueError({ kind: "json" }, undefined, false), undefined);
  assert.equal(formValueError({ kind: "json" }, undefined, true), "Required");
  const dictionary = {
    kind: "object" as const,
    properties: {},
    additionalProperties: { kind: "number" as const },
  };
  assert.equal(formValueError(dictionary, { limit: 3 }, true), undefined);
  assert.equal(
    formValueError(dictionary, { limit: "three" }, true),
    "Invalid dictionary value",
  );
});

test("every enabled step has a separately bound reusable config node", () => {
  const catalog = createConfigCatalog();
  const coverage = JSON.parse(
    readFileSync("examples/workflow-form/coverage.json", "utf8"),
  );
  const graph = compileSqueed(resolveStateView(catalog.view, catalog.state));
  for (const type of coverage.enabledStepTypes) {
    assert.ok(catalog.bindings[`root.config_${type}`]);
    assert.ok(
      graph.nodes.some((node) => node.data.id === `root.config_${type}`),
    );
    assert.ok(graph.nodes.some((node) => node.data.id === `root.step_${type}`));
  }
  assert.equal(
    graph.nodes.filter((node) => node.data.id === "root.config_http").length,
    1,
  );
  assert.equal(
    graph.edges.filter(
      (edge) => edge.data.target === "root.config_http" && edge.data.connection,
    ).length,
    2,
  );
  catalog.state.configs.http.config = {
    url: "https://example.com",
    method: "POST",
    body: { value: false },
  };
  const before = structuredClone(catalog.state);
  const materialized = materializeStepConfigs(catalog.state);
  const users = materialized.steps.filter((step) => step.type === "http");
  assert.deepEqual(users[0].config, users[1].config);
  assert.notEqual(users[0].config, users[1].config);
  assert.deepEqual(catalog.state, before);
  assert.equal("configRef" in users[0], false);
  catalog.state.configs.http.type = "llm";
  assert.throws(() => materializeStepConfigs(catalog.state), /type mismatch/);
  delete catalog.state.configs.http;
  assert.throws(
    () => materializeStepConfigs(catalog.state),
    /Missing configuration/,
  );
});

test("catalog conditional fields retain multi-value editor conditions", () => {
  const { state, bindings } = createConfigCatalog();
  const condition = bindings["root.config_http"].fields!.body.$visibleWhen!;
  for (const method of ["POST", "PUT", "PATCH"]) {
    state.configs.http.config.method = method;
    assert.equal(conditionMatches(condition, state), true);
  }
  state.configs.http.config.method = "GET";
  assert.equal(conditionMatches(condition, state), false);
});
