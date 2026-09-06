import assert from "node:assert/strict";
import { test } from "node:test";
import { createConfiguredDiagram } from "../examples/declarative/adapter";
import {
  DIAGRAM_SOURCE,
  DIAGRAM_BINDINGS,
  iconLabelDesign,
  iconLabelView,
} from "../examples/workflow-state-3/example";
import { configuredDesign } from "../examples/workflow-state-2/configured";
import {
  CONDITIONAL_SOURCE,
  CONDITIONAL_BINDINGS,
  CONDITIONAL_DESIGN,
} from "../examples/conditional-workflow/example";
import { projectResourceView } from "../examples/workflow-state/resourceMapping";

test("Workflow State 3 keeps State 2 data and applies icon-label defaults including generated resources", () => {
  const original = JSON.stringify(DIAGRAM_SOURCE);
  const next = createConfiguredDiagram(
    DIAGRAM_SOURCE,
    DIAGRAM_BINDINGS,
    iconLabelDesign("full"),
  );
  const view = iconLabelView({
    ...next.view,
    resource_model: { $view: "object", name: "model" },
  });
  for (const [key, node] of Object.entries(view))
    if (!key.startsWith("$")) assert.equal(node.$view, "icon-label", key);
  assert.equal(JSON.stringify(DIAGRAM_SOURCE), original);
  assert.equal(configuredDesign("full").nodes.step_agent_act.$view, "object");
  assert.equal(iconLabelDesign("full").canvas?.edgeMode, "properties");
  assert.equal(
    iconLabelView(
      { resource_model: { $view: "object" } },
      { resource_model: {} },
    ).resource_model.$view,
    "object",
  );
  const document: any = {
    view: { item: { $view: "icon-label" } },
    state: { sdkResources: { item: { value: { model: "example" } } } },
  };
  assert.equal(projectResourceView(document).item.$view, "object");
  assert.equal(projectResourceView(document, true).item.$view, "icon-label");
});

test("conditional template branches before invoking a workflow and keeps both labels", () => {
  const result = createConfiguredDiagram(
    CONDITIONAL_SOURCE,
    CONDITIONAL_BINDINGS,
    CONDITIONAL_DESIGN,
  );
  const [condition, workflow, otherwise] = CONDITIONAL_SOURCE.workflow.steps;
  assert.equal(condition.type, "conditional");
  assert.equal(condition.config.onTrue, workflow.id);
  assert.equal(condition.config.onFalse, otherwise.id);
  assert.equal(workflow.type, "spawn_workflow");
  assert.deepEqual(workflow.dependsOn, [condition.id]);
  const branches = result.view.step_check.$connections;
  assert.deepEqual(
    branches.map((branch) => branch.target),
    ["root.step_run", "root.step_skip"],
  );
  assert.match(branches[0].label, /true/);
  assert.match(branches[1].label, /false/);
});
