import assert from "node:assert/strict";
import { test } from "node:test";
import { editTemplateConnections, readTemplateUses, syncTemplateGraph } from "../examples/workflow-state/templateReferences";

test("template expressions expose references without evaluation or losing fallback branches", async () => {
  const state = { steps: [
    { id: "agent", config: { prompt: "{{input.prompt}}", data: { status: "{{steps.normalize.result}}", summary: "{{steps.agent.result.summary || input.summary || ''}}" } } },
    { id: "normalize", config: {} },
  ] };
  const bindings = { "root.agent": { address: "root.steps.0.config", type: "Agent" }, "root.normalize": { address: "root.steps.1.config", type: "Normalize" } };
  const view = { agent: {}, normalize: {} };
  const before = JSON.stringify(state);
  const uses = await readTemplateUses(state, view, bindings);
  assert.deepEqual(uses.map(use => use.path), ["input.prompt", "steps.normalize.result", "steps.agent.result.summary", "input.summary"]);
  const projected = syncTemplateGraph(view, state, bindings, uses, "LR");
  assert.equal(projected.view.template_input.prompt, "{{input.prompt}}");
  assert.equal(projected.view.template_input.$view, "object");
  assert.equal(projected.view.normalize.$connections[0].target, "root.agent");
  assert.equal(projected.view.normalize.$connections[0].targetProperty, "data");
  assert.equal(JSON.stringify(state), before);
  const deleted = { ...projected.view, template_input: { ...projected.view.template_input, $connections: [] } };
  assert.equal(syncTemplateGraph(deleted, state, bindings, uses, "LR", projected.graph).view, deleted);
  const cleared = syncTemplateGraph(projected.view, state, bindings, [], "LR", projected.graph);
  assert.equal(cleared.view.template_input, undefined);
  assert.equal(cleared.view.templateVariables, undefined);
  assert.deepEqual(cleared.view.normalize.$connections, []);
  assert.deepEqual(cleared.view.normalize.$ports, []);
});

test("mapped structured templates attach to their visible object rows", async () => {
  const state = { sdkResources: { data: { value: { status: "{{steps.normalize.result}}", execution_id: "{{execution['id']}}", summary: "{{input.summary}}" } } } };
  const uses = await readTemplateUses(state, { data: {} }, {});
  assert.deepEqual(uses.map(use => [use.path, use.property, use.row]), [
    ["steps.normalize.result", "status", true], ["execution.id", "execution_id", true], ["input.summary", "summary", true],
  ]);
});

test("disconnect and reconnect update only the chosen fallback source", async () => {
  const expression = "{{steps.agent.result.status || steps.agent.output.status}}";
  const state = { steps: [{ id: "agent", config: {} }, { id: "normalize", config: { value: expression } }, { id: "other", config: {} }] };
  const bindings = Object.fromEntries(state.steps.map((step, index) => [`root.${step.id}`, { type: "Config", address: `root.steps.${index}.config` }]));
  const view = { agent: {}, normalize: {}, other: {} };
  const initial = syncTemplateGraph(view, state, bindings, await readTemplateUses(state, view, bindings), "LR");
  const removedView = { ...initial.view, agent: { ...initial.view.agent, $connections: initial.view.agent.$connections.filter(connection => connection.sourceProperty !== "template:result.status") } };
  const removed = await editTemplateConnections(removedView, initial.view, state, bindings, initial.graph);
  assert.equal(removed.state.steps[1].config.value, "{{steps.agent.output.status}}");
  assert.ok(removed.view.agent.$ports.some(port => port.id === "template:result.status"));
  const reconnectedView = { ...removed.view, other: { $connections: [{ id: "drawn", target: "root.normalize", sourceProperty: "template:result.status", targetProperty: "value" }] } };
  const reconnected = await editTemplateConnections(reconnectedView, removed.view, removed.state, bindings, removed.templateGraph);
  assert.equal(reconnected.state.steps[1].config.value, "{{steps.other.result.status || steps.agent.output.status}}");
  assert.equal(reconnected.view.other.$connections.length, 1);
  assert.equal(state.steps[1].config.value, expression);
});