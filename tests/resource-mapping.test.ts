import assert from "node:assert/strict";
import { test } from "node:test";
import type { FormSchema } from "../src/core/forms";
import { changeMappedState, configureResources, exportResourceState, projectResourceView, resourceFormContext, validateResourceMapping } from "../examples/workflow-state/resourceMapping";
import { compileSqueed } from "../src/core/squeedEdits";
import { applyStateEdits, resolveStateView } from "../src/utils/formState";
import { reconcileWorkflowConnections } from "../examples/workflow-state/ports";

const schema: FormSchema = { Llm: { kind: "object", properties: {
  prompt: { type: { kind: "string" }, optional: false },
  model: { type: { kind: "string" }, optional: true },
  options: { type: { kind: "json" }, optional: true },
} } };
const bindings = { "root.agent": { address: "root.steps.0.config", type: "Llm" } };
const mapping = { version: 1 as const, fields: [{ type: "Llm", field: "prompt" }, { type: "Llm", field: "model" }, { type: "Llm", field: "options" }] };

test("static mappings lift only present values and export losslessly", () => {
  const state = { steps: [{ config: { prompt: "{{input.prompt}}\nInstructions", options: { enabled: false, count: 0, list: [null, ""] } }, params: { prompt: "unchanged" } }] };
  const input = { schema, bindings, state, view: { agent: { $label: "Agent" } } };
  const before = JSON.stringify(input);
  const document = configureResources(input, mapping);
  assert.equal(Object.keys(document.state.sdkResources).length, 2);
  assert.equal(document.state.steps[0].config.model, undefined);
  assert.deepEqual(exportResourceState(document), state);
  assert.equal(JSON.stringify(input), before);
  const context = resourceFormContext(document, schema, bindings);
  const projected = projectResourceView(document);
  const objectId = document.state.steps[0].config.options;
  assert.equal(projected[objectId].$view, "object");
  assert.equal(projected[objectId].enabled, false);
  assert.equal(projected[objectId].count, 0);
  const graph = compileSqueed(resolveStateView(projected, document.state));
  assert.equal(graph.nodes.find(node => node.data.id === `root.${objectId}`)!.data.type, "objectView");
  assert.equal(context.schema.Llm.ports!.prompt.kind, "config");
  assert.equal(Object.keys(context.bindings).length, 3);
  const id = document.state.steps[0].config.prompt;
  document.state.sdkResources[id].value = "edited";
  assert.equal(exportResourceState(document).steps[0].config.prompt, "edited");
  assert.equal(exportResourceState(document).steps[0].params.prompt, "unchanged");
  const cleared = configureResources(input, { version: 1, fields: [] }, document);
  assert.equal(cleared.state.steps[0].config.prompt, "edited");
  assert.equal(cleared.state.sdkResources, undefined);
  assert.equal(cleared.view[id], undefined);
  assert.equal(cleared.view.agent.$label, "Agent");
});

test("mapping validation and export reject unknown fields and dangling references", () => {
  assert.throws(() => validateResourceMapping({ version: 1, fields: [{ type: "Llm", field: "missing" }] }, schema));
  assert.throws(() => validateResourceMapping({ version: 1, fields: [{ type: "Llm", field: "__proto__" }] }, schema));
  const document = configureResources({ schema, bindings, state: { steps: [{ config: { prompt: "hello" } }] }, view: { agent: {} } }, mapping);
  document.state.steps[0].config.prompt = "unknown";
  assert.throws(() => exportResourceState(document), /Unresolved reusable configuration/);
});

test("explicit empty resources provide nodes without inventing workflow values", () => {
  const state = { steps: [{ config: { prompt: "{{input.prompt}}" } }] };
  const document = configureResources({ schema, bindings, state, view: { agent: {} } }, {
    version: 1, fields: [{ type: "Llm", field: "prompt" }, { type: "Llm", field: "model", createEmpty: true }],
  });
  assert.equal(Object.keys(document.state.sdkResources).length, 2);
  assert.deepEqual(exportResourceState(document), state);
  const id = document.state.steps[0].config.model;
  document.state.sdkResources[id].value = "chosen-model";
  assert.equal(exportResourceState(document).steps[0].config.model, "chosen-model");
});

test("resource selections share edits and deletion clears only the matching reference", () => {
  const state = { steps: [{ config: { prompt: "first" } }, { config: { prompt: "second" } }] };
  const sharedBindings = { ...bindings, "root.other": { address: "root.steps.1.config", type: "Llm" } };
  const input = { schema, bindings: sharedBindings, state, view: { agent: {}, other: {} } };
  const original = configureResources(input, { version: 1, fields: [{ type: "Llm", field: "prompt" }] });
  const id = original.state.steps[0].config.prompt;
  const selected = changeMappedState(original, applyStateEdits(original.state, [{ op: "set", address: "root.steps.1.config.prompt", value: id }]), "root.steps.1.config.prompt");
  assert.equal(selected.view[id].$connections.length, 2);
  const edited = changeMappedState(selected, applyStateEdits(selected.state, [{ op: "set", address: `root.sdkResources.${id}.value`, value: "shared edit" }]));
  assert.deepEqual(exportResourceState(edited).steps.map(step => step.config.prompt), ["shared edit", "shared edit"]);
  const context = resourceFormContext(edited, schema, sharedBindings);
  const removed = { ...edited.view, [id]: { ...edited.view[id], $connections: edited.view[id].$connections.filter(connection => connection.target !== "root.other") } };
  const reconciled = reconcileWorkflowConnections(removed, edited.state, context.schema, edited.view, context.bindings);
  const exported = exportResourceState({ ...edited, ...reconciled });
  assert.equal(exported.steps[0].config.prompt, "shared edit");
  assert.equal(exported.steps[1].config.prompt, undefined);
  assert.equal(original.state.sdkResources[id].value, "first");
});