import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import workflow from "../examples/workflow-state-2/workflow.json";
import { createCastSessionExample } from "../examples/workflow-state-2/example";
import {
  projectWorkflowPorts,
  reconcileWorkflowConnections,
} from "../examples/workflow-state/ports";
import { readFormSchema } from "../src/core/forms";
import { compileSqueed } from "../src/core/squeedEdits";
import { resolveStateView } from "../src/utils/formState";

test("cast session preserves the supplied workflow and connects its real dependencies", async () => {
  const { state, view, bindings } = createCastSessionExample();
  assert.deepEqual(state.workflow, workflow);
  assert.equal(state.workflow.steps.length, 16);
  assert.equal(Object.keys(state.tools).length, 23);
  const source = readFileSync("examples/workflow-state-2/interface.ts", "utf8");
  const schema = await readFormSchema(
    { name: "interface.ts", size: source.length, text: async () => source },
    [...new Set(Object.values(bindings).map((binding) => binding.type))],
  );
  for (const [index, step] of state.workflow.steps.entries()) {
    const type = schema[bindings[`root.step_${step.id}`].type];
    for (const field of Object.keys(step.config))
      assert.ok(type.properties[field], `${step.id}.${field}`);
    assert.equal(
      bindings[`root.step_${step.id}`].address,
      `root.workflow.steps.${index}.config`,
    );
  }
  const projected = projectWorkflowPorts(view, schema, "LR", bindings);
  const graph = compileSqueed(resolveStateView(projected, state));
  assert.equal(
    graph.nodes.filter((node) => node.data.id.startsWith("root.tool_")).length,
    0,
  );
  const tools = graph.nodes.find((node) => node.data.id === "root.tools")!;
  assert.ok(tools);
  assert.equal(view.tools.$view, "icon-label");
  assert.equal(Object.keys(bindings["root.tools"].portResources!).length, 23);
  assert.equal(
    graph.edges.filter((edge) => edge.data.targetProperty === "config:tools")
      .length,
    23,
  );
  assert.ok(
    graph.edges
      .filter((edge) => edge.data.targetProperty === "config:tools")
      .every((edge) => edge.data.source === "root.tools"),
  );
  assert.equal(
    projected.step_agent_act.$ports.filter((port) => port.id === "config:tools")
      .length,
    1,
  );
  for (const step of state.workflow.steps)
    for (const parent of step.dependsOn ?? [])
      assert.ok(
        graph.edges.some(
          (edge) =>
            edge.data.source === `root.step_${parent}` &&
            edge.data.target === `root.step_${step.id}`,
        ),
      );
  assert.equal(
    graph.edges.filter(
      (edge) => edge.data.source === "root.trigger" && edge.data.connection,
    ).length,
    2,
  );
  assert.equal(
    reconcileWorkflowConnections(view, state, schema, view, bindings).state,
    state,
  );
  const fresh = createCastSessionExample();
  assert.notEqual(state.workflow, fresh.state.workflow);
});
