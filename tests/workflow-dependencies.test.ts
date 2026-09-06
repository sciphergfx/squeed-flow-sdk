import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reconcileWorkflowDependencies,
  type WorkflowDependencyMapping,
} from "../examples/workflow-state/dependencies";

const mapping: WorkflowDependencyMapping = {
  stepsAddress: "root.workflow.steps",
  nodes: {
    "root.first": "load",
    "root.second": "save",
    "root.third": "notify",
  },
  sourceProperty: "output:output",
  targetProperty: "input:input",
};
const connection = (target = "root.second") => ({
  target,
  sourceProperty: mapping.sourceProperty,
  targetProperty: mapping.targetProperty,
});
const state = {
  workflow: {
    steps: [
      { id: "load", config: { value: 1 } },
      {
        id: "save",
        dependsOn: ["outside", "load"],
        condition: "ready",
        config: { value: 2 },
      },
      { id: "notify", config: { value: 3 } },
    ],
  },
};
const view = {
  first: { $connections: [connection()] },
  second: {},
  third: {},
  resource: {},
};

test("dependency deletion updates only the target array and keeps unprojected dependencies", () => {
  const original = structuredClone(state);
  const next = reconcileWorkflowDependencies(
    { ...view, first: {} },
    view,
    state,
    mapping,
  );
  assert.deepEqual(next.workflow.steps[1], {
    ...state.workflow.steps[1],
    dependsOn: ["outside"],
  });
  assert.equal(next.workflow.steps[0], state.workflow.steps[0]);
  assert.deepEqual(state, original);
});

test("drawing and retargeting dependencies preserve step IDs, order and non-dependency fields", () => {
  const drawing = { ...view, third: { $connections: [connection()] } };
  const added = reconcileWorkflowDependencies(drawing, view, state, mapping);
  assert.deepEqual(added.workflow.steps[1].dependsOn, [
    "outside",
    "load",
    "notify",
  ]);
  assert.equal(
    reconcileWorkflowDependencies(drawing, drawing, added, mapping),
    added,
  );
  const retargeted = reconcileWorkflowDependencies(
    { ...view, first: { $connections: [connection("root.third")] } },
    view,
    state,
    mapping,
  );
  assert.deepEqual(retargeted.workflow.steps[1].dependsOn, ["outside"]);
  assert.deepEqual(retargeted.workflow.steps[2].dependsOn, ["load"]);
  assert.equal(
    retargeted.workflow.steps[1].config,
    state.workflow.steps[1].config,
  );
});

test("template, configuration, trigger and unmapped links are not dependencies", () => {
  for (const sourceProperty of ["template:result", "output:resource"]) {
    assert.equal(
      reconcileWorkflowDependencies(
        {
          ...view,
          third: { $connections: [{ ...connection(), sourceProperty }] },
        },
        view,
        state,
        mapping,
      ),
      state,
    );
  }
  for (const targetProperty of ["config:tools", "config:prompt"]) {
    assert.equal(
      reconcileWorkflowDependencies(
        {
          ...view,
          third: { $connections: [{ ...connection(), targetProperty }] },
        },
        view,
        state,
        mapping,
      ),
      state,
    );
  }
  assert.equal(
    reconcileWorkflowDependencies(
      {
        ...view,
        trigger: { $connections: [connection()] },
        resource: { $connections: [connection()] },
      },
      view,
      state,
      mapping,
    ),
    state,
  );
  assert.equal(
    reconcileWorkflowDependencies(
      { ...view, third: { $connections: [connection("root.resource")] } },
      view,
      state,
      mapping,
    ),
    state,
  );
  assert.equal(reconcileWorkflowDependencies(view, view, state), state);
});

test("node links and parallel execution links use the same dependency without duplicates", () => {
  const drawing = {
    ...view,
    third: {
      $target: "root.second",
      $connections: [connection(), connection()],
    },
  };
  const next = reconcileWorkflowDependencies(drawing, view, state, mapping);
  assert.deepEqual(next.workflow.steps[1].dependsOn, [
    "outside",
    "load",
    "notify",
  ]);
  const oneRemaining = { ...view, third: { $target: "root.second" } };
  assert.equal(
    reconcileWorkflowDependencies(oneRemaining, drawing, next, mapping),
    next,
  );
  assert.deepEqual(
    reconcileWorkflowDependencies(view, oneRemaining, next, mapping),
    state,
  );
});

test("step reordering uses stable IDs and deleting the final prerequisite writes an empty array", () => {
  const reordered = {
    workflow: { steps: [{ id: "save", dependsOn: ["load"] }, { id: "load" }] },
  };
  const next = reconcileWorkflowDependencies(
    { ...view, first: {} },
    view,
    reordered,
    mapping,
  );
  assert.deepEqual(next.workflow.steps, [
    { id: "save", dependsOn: [] },
    { id: "load" },
  ]);
});
