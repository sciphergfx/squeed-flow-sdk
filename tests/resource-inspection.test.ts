import assert from "node:assert/strict";
import { test } from "node:test";
import { configureResources, exportResourceState } from "../examples/workflow-state/resourceMapping";
import { projectResourceInspection } from "../examples/workflow-state/resourceInspection";
import { compileSqueed } from "../src/core/squeedEdits";

test("inspection displays resolved resource values without changing bindings or losing other fields", () => {
  const schema: any = { Task: { kind: "object", properties: { prompt: { type: { kind: "string" } }, model: { type: { kind: "string" }, optional: true }, tools: { type: { kind: "array", items: { kind: "string" } } } } } };
  const state = { config: { prompt: "Describe the result", tools: ["browser_navigate_page"] } };
  const bindings = { "root.task": { address: "root.config", type: "Task" } };
  const document = configureResources({ state, view: { task: { $view: "icon-label", $icon: "PiRobot" } }, bindings, schema }, { version: 1, fields: [{ type: "Task", field: "prompt" }, { type: "Task", field: "model", createEmpty: true }] });
  const before = JSON.stringify(document);
  const projected = projectResourceInspection(document.view, document, schema, bindings);
  assert.equal(projected.task.prompt, state.config.prompt);
  assert.equal(projected.task.model, "");
  assert.deepEqual(JSON.parse(projected.task.tools), state.config.tools);
  assert.equal(JSON.stringify(document), before);
  assert.deepEqual(exportResourceState(document), state);
  const graph = compileSqueed(projected);
  const node = graph.nodes.find(node => node.data.id === "root.task")!;
  assert.equal(node.data.description?.prompt, state.config.prompt);
  assert.equal(node.data.description?.model, "");
  assert.equal(node.data.config?.view, "icon-label");
});