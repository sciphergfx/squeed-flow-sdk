import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyStateEdits,
  changeFormState,
  resolveStateForm,
  resolveStateView,
} from "../src/utils/formState";

test("form state edits and display references leave the Squeed view unchanged", () => {
  const state = {
    step: { name: "Assistant", description: "Original" },
    sibling: { keep: true },
  };
  const view = {
    agent: {
      $label: { $state: "root.step.name" },
      $content: { $state: "root.step.description" },
    },
  };
  const before = structuredClone(view);
  const next = changeFormState(state, {
    data: state,
    address: "root.step.description",
    nodeAddress: "root.step",
    value: "Updated",
    previousValue: "Original",
  });
  assert.equal(next.step.description, "Updated");
  assert.equal(next.sibling, state.sibling);
  assert.deepEqual(resolveStateView(view, next), {
    agent: { $label: "Assistant", $content: "Updated" },
  });
  assert.deepEqual(view, before);
  assert.equal(state.step.description, "Original");
  assert.throws(
    () =>
      changeFormState(state, {
        data: state,
        address: "root.step",
        nodeAddress: "root",
        previousValue: state.step,
        value: { $collapsed: true },
      }),
    /metadata/,
  );
});

test("state form bindings select interfaces without adding metadata to data", () => {
  const type = {
    kind: "object" as const,
    properties: {
      name: { type: { kind: "string" as const }, optional: false },
    },
  };
  assert.deepEqual(
    resolveStateForm(
      { "root.agent": { address: "root.steps.0", type: "Step" } },
      "root.agent",
      { Step: type },
    ),
    { address: "root.steps.0", type, fields: {} },
  );
});
