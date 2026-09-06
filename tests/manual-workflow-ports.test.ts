import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readFormSchema } from "../src/core/forms";
import { projectWorkflowView, projectWorkflowPorts, reconcileWorkflowConnections, workflowNodeBindings, workflowResourceOptions } from "../examples/workflow-state/ports";
import { compileSqueed } from "../src/core/squeedEdits";
import { resolveStateView } from "../src/utils/formState";

async function fixture() {
  const source = readFileSync("examples/workflow-state/interface.ts", "utf8");
  const schema = await readFormSchema({ name: "interface.ts", size: source.length, text: async () => source }, Object.values(workflowNodeBindings).map(binding => binding.type));
  const state = JSON.parse(readFileSync("examples/workflow-state/state.json", "utf8"));
  const view = Object.fromEntries(Object.keys(workflowNodeBindings).map(address => [address.slice(5), { $label: address }]));
  return { schema, state, view };
}

test("schemas guide ports without removing saved workflow connections or changing state", async () => {
  const { schema, state } = await fixture();
  const view = JSON.parse(readFileSync("examples/workflow-state/view.json", "utf8"));
  const before = JSON.stringify({ view, state });
  const graph = compileSqueed(resolveStateView(view, state));
  assert.equal(graph.edges.filter(edge => edge.data.connection).length, 10);
  assert.equal(reconcileWorkflowConnections(view, state, schema).state, state);
  for (const formSchema of [schema, undefined, { ...schema, LlmConfig: { kind: "object" as const, properties: {} } }]) {
    const projected = compileSqueed(resolveStateView(projectWorkflowView(view, state, formSchema, "LR"), state));
    assert.deepEqual(projected.edges.map(edge => edge.data.id), graph.edges.map(edge => edge.data.id));
  }
  assert.equal(JSON.stringify({ view, state }), before);
});

test("TS-defined ports surround the node and never generate edges or restore deleted nodes", async () => {
  const { schema, state, view } = await fixture();
  for (const [direction, input, config, output] of [["LR", "left", "top", "right"], ["RL", "right", "bottom", "left"], ["TB", "top", "right", "bottom"], ["BT", "bottom", "left", "top"]] as const) {
    const projected = projectWorkflowPorts(view, schema, direction);
    assert.equal(projected.assistant.$ports.length, 7);
    assert.equal(projected.assistant.$ports.filter(port => port.placement === "config").length, 5);
    assert.equal(projected.directoryTool.$ports[0].side, output);
    assert.equal(projected.directoryTool.$ports[0].placement, undefined);
    for (const port of projected.assistant.$ports)
      assert.equal(port.side, port.id.startsWith("input:") ? input : port.id.startsWith("config:") ? config : output);
    assert.equal(projected.assistant.$connections, undefined);
    delete projected.model;
    assert.equal(projectWorkflowPorts(projected, schema, direction).model, undefined);
  }
  delete schema.LlmConfig.ports!.model;
  assert.equal(projectWorkflowPorts(view, schema, "LR").assistant.$ports.length, 6);
  assert.ok(state.steps[0]);
});

test("manual config connections enforce types, cardinality, deletion and immutability", async () => {
  const { schema, state, view } = await fixture();
  const before = JSON.stringify(state);
  const drawing: any = { ...view,
    prompt: { ...view.prompt, $connections: [{ target: "root.assistant", sourceProperty: "output:resource", targetProperty: "config:promptId" }] },
    directoryTool: { ...view.directoryTool, $connections: [{ target: "root.assistant", sourceProperty: "output:resource", targetProperty: "config:tools" }] },
    issueTool: { ...view.issueTool, $connections: [{ target: "root.assistant", sourceProperty: "output:resource", targetProperty: "config:tools" }] },
    model: { ...view.model, $connections: [{ target: "root.assistant", sourceProperty: "output:resource", targetProperty: "config:promptId" }] },
  };
  const attached = reconcileWorkflowConnections(drawing, state, schema);
  assert.equal(attached.state.steps[0].config.promptId, "user_review");
  assert.deepEqual(attached.state.steps[0].config.tools, ["directory_lookup", "issue_lookup"]);
  assert.deepEqual(attached.view.model.$connections, []);
  assert.equal(JSON.stringify(state), before);
  const replaced = reconcileWorkflowConnections({ ...attached.view, instructions: { $connections: [{ target: "root.assistant", sourceProperty: "output:resource", targetProperty: "config:promptId" }] } }, attached.state, schema);
  assert.equal(replaced.state.steps[0].config.promptId, "directory_guidance");
  assert.deepEqual(replaced.view.prompt.$connections, []);
  const removed = reconcileWorkflowConnections({ ...attached.view, prompt: { $label: "Prompt" } }, attached.state, schema);
  assert.equal(removed.state.steps[0].config.promptId, undefined);
  assert.equal(removed.state.texts, state.texts);
  const deleted = { ...attached.view };
  delete deleted.directoryTool;
  assert.deepEqual(reconcileWorkflowConnections(deleted, attached.state, schema).state.steps[0].config.tools, ["issue_lookup"]);
});

test("connection edits preserve unrelated data and existing edges after a schema replacement", async () => {
  const { schema, state } = await fixture();
  const view = JSON.parse(readFileSync("examples/workflow-state/view.json", "utf8"));
  const changedSchema = structuredClone(schema);
  delete changedSchema.LlmConfig.ports!.tools;
  const result = reconcileWorkflowConnections(view, state, changedSchema, view);
  assert.equal(result.view, view);
  assert.equal(result.state, state);
  const edited = { ...view, model: { ...view.model, $connections: [] } };
  const detached = reconcileWorkflowConnections(edited, state, changedSchema, view);
  assert.equal(detached.state.steps[0].config.model, undefined);
  assert.deepEqual(detached.state.steps[0].config.tools, state.steps[0].config.tools);
  assert.equal(detached.view.directoryTool, view.directoryTool);
});

test("one object exposes multiple resources without merging their connection identities", async () => {
  const { schema, state } = await fixture();
  const groupedBindings = {
    "root.assistant": workflowNodeBindings["root.assistant"],
    "root.tools": { address: "root", type: "ToolConfig", portResources: {
      "output:directory": "root.tools.directory_lookup", "output:issue": "root.tools.issue_lookup",
    } },
  };
  schema.ToolConfig.ports = { directory: { kind: "output" }, issue: { kind: "output" } };
  const view = { assistant: {}, tools: { $connections: [
    { target: "root.assistant", sourceProperty: "output:directory", targetProperty: "config:tools" },
    { target: "root.assistant", sourceProperty: "output:issue", targetProperty: "config:tools" },
  ] } };
  const removed = { ...view, tools: { $connections: view.tools.$connections.slice(1) } };
  const result = reconcileWorkflowConnections(removed, state, schema, view, groupedBindings);
  assert.deepEqual(result.state.steps[0].config.tools, ["issue_lookup"]);
  assert.equal(result.state.tools, state.tools);
  assert.deepEqual(workflowResourceOptions(schema, "root.assistant", "root.steps.0.config.tools", state, groupedBindings).map(option => option.value), ["directory_lookup", "issue_lookup"]);
});