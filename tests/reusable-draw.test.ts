import { test } from "node:test";
import assert from "node:assert/strict";
import { reusableDrawItems, createReusableStep, connectReusable, type ReusableDrawPackage } from "../examples/declarative/reusableDraw";
import { createConfiguredDiagram } from "../examples/declarative/adapter";

const config: ReusableDrawPackage = { version: 1, source: { jobs: [{ key: "original", kind: "task", title: "Original", settings: { value: 7 } }] },
  bindings: { version: 1, title: "root.title", exportAddress: "root", nodes: {}, collection: { address: "root.jobs", idField: "key", typeField: "kind", labelField: "title", propertiesField: "settings", subtitleFields: [], nodePrefix: "job_", types: { task: "Task" } }, dependencies: { field: "needs", sourceProperty: "output:out", targetProperty: "input:in" } },
  design: { version: 1, defaults: { $view: "icon-label" }, nodes: {}, types: { task: { $icon: "PiGear" } }, mapping: { version: 1, fields: [] } },
  schema: { Task: { kind: "object", properties: { value: { type: { kind: "number" }, optional: false } }, ports: { out: { kind: "output" }, in: { kind: "input" } } } },
};
test("reusable workflow creation follows JSON identity/dependency fields and preserves the draw port", () => {
  const projected = createConfiguredDiagram(config.source, config.bindings, config.design);
  const request = { sourceNodeId: "root.job_original", sourceProperty: "output:out", reverse: false, position: { x: 1200, y: 750 } };
  const items = reusableDrawItems(config, projected.view, projected.state, config.schema, projected.bindings, request);
  assert.equal(items[0].icon, "PiGear"); assert.deepEqual(items[0].ports, ["input:in"]);
  const created = createReusableStep(config, items[0], request, "input:in", "next");
  assert.deepEqual(created.configuration.source.jobs[1], { key: "next", kind: "task", title: "Task", settings: { value: 7 }, needs: ["original"] });
  assert.equal(config.source.jobs.length, 1);
  assert.equal(created.address, "root.job_next");
  const reverse = { ...request, sourceProperty: "input:in", reverse: true };
  const reverseItem = reusableDrawItems(config, projected.view, projected.state, config.schema, projected.bindings, reverse)[0];
  assert.deepEqual(createReusableStep(config, reverseItem, reverse, "output:out", "before").configuration.source.jobs[0].needs, ["before"]);
});
test("shared resources are reused and reveal collapsed parents without cloning state", () => {
  const view = { step: {}, group: { $collapsed: true }, model: { $parent: "root.group", $label: "Model", $icon: "PiSliders" } };
  const schema: any = { Step: { ports: { model: { kind: "config", resourceType: "Model" } } }, Model: { ports: { resource: { kind: "output" } } } };
  const bindings = { "root.step": { address: "root.step", type: "Step" }, "root.model": { address: "root.models.shared", type: "Model" } };
  const request = { sourceNodeId: "root.step", sourceProperty: "config:model", reverse: true, position: { x: 500, y: 200 } };
  const item = reusableDrawItems(undefined, view, {}, schema, bindings, request)[0];
  assert.equal(item.icon, "PiSliders"); assert.deepEqual(item.ports, ["output:resource"]);
  const connected = connectReusable(view, request, item.address!, item.ports[0]);
  assert.equal(connected.group.$collapsed, false);
  assert.equal(connected.model.$connections[0].targetProperty, "config:model");
  assert.deepEqual(Object.keys(connected), Object.keys(view));
  assert.equal(view.group.$collapsed, true);
  assert.equal(connectReusable(connected, request, item.address!, item.ports[0]).model.$connections.length, 1);
});