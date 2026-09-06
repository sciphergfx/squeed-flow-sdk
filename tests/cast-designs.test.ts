import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import workflow from "../examples/workflow-state-2/workflow.json";
import { CAST_DESIGNS, createCastDesign } from "../examples/workflow-state-2/designs";
import { configureResources, exportResourceState, projectResourceView, resourceFormContext } from "../examples/workflow-state/resourceMapping";
import { readTemplateUses, syncTemplateGraph } from "../examples/workflow-state/templateReferences";
import { projectWorkflowView, reconcileWorkflowConnections } from "../examples/workflow-state/ports";
import { readFormSchema } from "../src/core/forms";
import { compileSqueed } from "../src/core/squeedEdits";
import { resolveStateView } from "../src/utils/formState";

test("five distinct mappings render independent graph designs and exact API payloads", async () => {
  assert.equal(new Set(CAST_DESIGNS.map(design => JSON.stringify(design.mapping))).size, 5);
  const source = readFileSync("examples/workflow-state-2/interface.ts", "utf8");
  for (const design of CAST_DESIGNS) {
    const example = createCastDesign(design.id);
    assert.equal(example.view.step_agent_act.$view, "object");
    assert.match(example.view.step_agent_act.$content, /status.*summary/);
    const before = JSON.stringify(example);
    const schema = await readFormSchema({ name: "interface.ts", size: source.length, text: async () => source }, [...new Set(Object.values(example.bindings).map(binding => binding.type))]);
    let mapped = configureResources({ ...example, schema }, example.mapping);
    const context = resourceFormContext(mapped, schema, example.bindings);
    if (example.mapping.templates) {
      const templates = syncTemplateGraph(mapped.view, mapped.state, example.bindings, await readTemplateUses(mapped.state, mapped.view, example.bindings, schema), "LR");
      mapped = { ...mapped, view: templates.view, templateGraph: templates.graph };
    }
    const graph = compileSqueed(resolveStateView(projectWorkflowView(projectResourceView(mapped), mapped.state, context.schema, "LR", context.bindings), mapped.state));
    assert.equal(graph.edges.filter(edge => edge.data.targetProperty === "config:tools").length, 23, design.id);
    assert.equal(graph.nodes.filter(node => node.data.id.startsWith("root.tool_")).length, design.id === "tools" ? 23 : 0, design.id);
    assert.deepEqual(exportResourceState(mapped).workflow, workflow, design.id);
    assert.equal(JSON.stringify(example), before);
    const toolSource = design.id === "tools" ? "tool_browser_click" : "tools";
    const editedView = { ...mapped.view, [toolSource]: { ...mapped.view[toolSource], $connections: mapped.view[toolSource].$connections.filter(connection => connection.id !== "tool:browser_click:agent_act") } };
    const edited = reconcileWorkflowConnections(editedView, mapped.state, context.schema, mapped.view, context.bindings);
    const output = exportResourceState({ ...mapped, ...edited }).workflow;
    const expected = structuredClone(workflow);
    const agent = expected.steps.find(step => step.id === "agent_act")!;
    agent.config.tools = agent.config.tools.filter(tool => tool !== "browser_click");
    assert.deepEqual(output, expected, `${design.id} selective edit`);
  }
});