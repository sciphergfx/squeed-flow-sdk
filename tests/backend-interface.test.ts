import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { formOptions, readFormSchema } from "../src/core/forms";

test("backend validation projection loads named forms and preserves enum options", async () => {
  const source = readFileSync(
    "examples/workflow-form/backend-interface.ts",
    "utf8",
  );
  const schema = await readFormSchema(
    {
      name: "backend-interface.ts",
      size: source.length,
      text: async () => source,
    },
    ["WorkflowForm", "WorkflowStep"],
  );
  assert.deepEqual(
    formOptions(schema.WorkflowForm.properties.trigger.type)?.map(
      (option) => option.value,
    ),
    ["manual", "event", "schedule", "webhook", "api", "auto", "on_violation"],
  );
  assert.deepEqual(
    formOptions(schema.WorkflowForm.properties.executionMode.type)?.map(
      (option) => option.value,
    ),
    ["local", "server", "hybrid"],
  );
  assert.equal(schema.WorkflowForm.properties.id.optional, false);
  assert.equal(schema.WorkflowForm.properties.steps.optional, true);
  assert.equal(schema.WorkflowStep.properties.name.optional, true);
  assert.equal(schema.WorkflowStep.properties.type.type.kind, "string");
  assert.equal(schema.WorkflowStep.properties.action.type.kind, "string");
  assert.equal(schema.WorkflowStep.properties.prefetch.type.kind, "array");
  assert.equal(schema.WorkflowForm.properties.tenantVisible, undefined);
  assert.equal(schema.WorkflowStep.properties.cache, undefined);
  assert.equal(schema.WorkflowStep.properties.cacheable, undefined);
});
