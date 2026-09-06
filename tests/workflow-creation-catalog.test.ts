import assert from "node:assert/strict";
import { test } from "node:test";
import { workflowCreationCatalog } from "../../../backflow/backflow-admin/src/pages/sdk-test/workflowCreationCatalog";
import { STEP_TYPES, STEP_CONFIG_SCHEMAS } from "../../../backflow/backflow-admin/src/pages/workflows/constants";
import { createReusableStep, reusableDrawItems, type ReusableDrawPackage } from "../examples/declarative/reusableDraw";
import { createConfiguredDiagram } from "../examples/declarative/adapter";

const base: ReusableDrawPackage = { version: 1, source: { tasks: [{ key: "first", kind: "database", label: "Existing", settings: { collection: "private_items" } }] },
  bindings: { version: 1, title: "root.title", exportAddress: "root", nodes: {}, collection: { address: "root.tasks", idField: "key", typeField: "kind", labelField: "label", propertiesField: "settings", subtitleFields: [], nodePrefix: "task_", types: { database: "ExistingDatabase" } }, dependencies: { field: "needs", sourceProperty: "output:output", targetProperty: "input:input" } },
  design: { version: 1, defaults: { $view: "icon-label" }, types: { database: { $icon: "PiDatabase" } }, nodes: {}, mapping: { version: 1, fields: [] } },
  schema: { ExistingDatabase: { kind: "object", properties: { collection: { type: { kind: "string" }, optional: false } }, ports: { input: { kind: "input" }, output: { kind: "output" } } } },
};
test("every enabled editor step can be created from JSON catalog with all declared form fields", () => {
  const before = JSON.stringify(base);
  const config = workflowCreationCatalog(base);
  assert.deepEqual(Object.keys(config.bindings.collection.types).sort(), [...STEP_TYPES].sort());
  assert.equal(Object.keys(config.bindings.collection.types).length, 25);
  assert.equal(config.design.types.database.$icon, "PiDatabase");
  const request = { sourceNodeId: "root.task_first", sourceProperty: "output:output", reverse: false, position: { x: 700, y: 500 } };
  const projected = createConfiguredDiagram(config.source, config.bindings, config.design);
  const items = reusableDrawItems(config, projected.view, projected.state, config.schema, projected.bindings, request);
  for (const kind of STEP_TYPES) {
    const item = items.find(item => item.kind === kind)!;
    assert.ok(item, kind); assert.ok(item.ports.includes("input:input"), kind);
    const form = config.schema[item.type];
    for (const field of STEP_CONFIG_SCHEMAS[kind] ?? []) assert.ok(form.properties[field.name], `${kind}.${field.name}`);
    const created = createReusableStep(config, item, request, "input:input", `new_${kind}`);
    assert.equal(created.configuration.source.tasks[1].kind, kind);
    assert.deepEqual(created.configuration.source.tasks[1].needs, ["first"]);
    assert.deepEqual(created.configuration.source.tasks[1].settings, config.bindings.collection.templates![kind].defaults);
  }
  assert.equal(JSON.stringify(base), before);
  assert.equal(config.bindings.collection.templates!.database.defaults!.collection, undefined);
  assert.equal(config.bindings.collection.templates!.database.defaults!.provider, "database");
});
test("custom catalog definitions and reverse compatibility survive expansion", () => {
  const config = workflowCreationCatalog({ ...base, bindings: { ...base.bindings, collection: { ...base.bindings.collection, templates: { database: { label: "Query", defaults: { collection: "custom" } } } } } });
  assert.equal(config.bindings.collection.templates!.database.label, "Query");
  const projected = createConfiguredDiagram(config.source, config.bindings, config.design);
  const items = reusableDrawItems(config, projected.view, projected.state, config.schema, projected.bindings,
    { sourceNodeId: "root.task_first", sourceProperty: "input:input", reverse: true, position: { x: 0, y: 0 } });
  assert.deepEqual(items.find(item => item.kind === "output")!.ports, []);
  assert.ok(items.find(item => item.kind === "http")!.ports.includes("output:output"));
});