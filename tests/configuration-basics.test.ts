import assert from "node:assert/strict";
import { test } from "node:test";
import { applyStateEdits, resolveStateForm } from "../src/utils/formState";
import { materializeStepConfigs } from "../examples/workflow-form/catalog";
import {
  changeMappedState,
  configureResources,
  exportResourceState,
  resourceFormContext,
} from "../examples/workflow-state/resourceMapping";
import {
  createPropertyExample,
  projectSharedExample,
  sharedState,
  sharedBindings,
  propertyState,
  propertyBindings,
  propertyView,
  schema,
} from "../examples/configuration-basics/examples";

test("shared example edits one config for two steps and exports separate plain values", () => {
  const before = JSON.stringify(sharedState);
  for (const node of ["first", "second", "receipt"])
    assert.equal(
      resolveStateForm(sharedBindings, `root.${node}`, schema)?.address,
      "root.configs.receipt.config",
    );
  const edited = applyStateEdits(sharedState, [
    {
      op: "set",
      address: "root.configs.receipt.config.message",
      value: "Changed once",
    },
  ]);
  const resolved = materializeStepConfigs(edited as typeof sharedState);
  assert.deepEqual(
    resolved.steps.map((step) => step.config.message),
    ["Changed once", "Changed once"],
  );
  assert.equal("configs" in resolved, false);
  assert.equal("configRef" in resolved.steps[0], false);
  assert.notEqual(resolved.steps[0].config, resolved.steps[1].config);
  assert.match(
    projectSharedExample(edited as typeof sharedState).resolved.$content,
    /Changed once/,
  );
  assert.equal(JSON.stringify(sharedState), before);
  assert.throws(
    () => materializeStepConfigs({ ...sharedState, configs: {} }),
    /Missing configuration/,
  );
});

test("property example maps, shares, edits, exports and inlines one field without touching other settings", () => {
  const original = createPropertyExample();
  assert.equal(Object.keys(original.state.sdkResources).length, 2);
  assert.deepEqual(exportResourceState(original), propertyState);
  const reference = original.state.steps[0].config.message;
  const sharing = changeMappedState(
    original,
    applyStateEdits(original.state, [
      { op: "set", address: "root.steps.1.config.message", value: reference },
    ]),
    "root.steps.1.config.message",
  );
  assert.equal(sharing.view[reference].$connections.length, 2);
  const edited = changeMappedState(
    sharing,
    applyStateEdits(sharing.state, [
      {
        op: "set",
        address: `root.sdkResources.${reference}.value`,
        value: "Shared message",
      },
    ]),
  );
  const resolved = exportResourceState(edited);
  assert.deepEqual(
    resolved.steps.map((step) => step.config),
    [
      { message: "Shared message", enabled: true },
      { message: "Shared message", enabled: false },
    ],
  );
  assert.equal("sdkResources" in resolved, false);
  const forms = resourceFormContext(edited, schema, propertyBindings);
  assert.equal(
    forms.bindings[`root.${reference}`].address,
    `root.sdkResources.${reference}`,
  );
  const inline = configureResources(
    {
      state: propertyState,
      view: propertyView,
      schema,
      bindings: propertyBindings,
    },
    { version: 1, fields: [] },
    edited,
  );
  assert.deepEqual(inline.state, resolved);
  assert.equal(inline.view[reference], undefined);
});
