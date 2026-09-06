import assert from "node:assert/strict";
import { test } from "node:test";
import preset from "../examples/execution/backflow.json";
import {
  validateExecutionMapping,
  prepareMappedExecution,
  mappingBody,
  mappingPath,
  applyExecutionEvent,
  applyExecutionResponse,
  type ExecutionOutput,
} from "../../../backflow/backflow-admin/src/pages/sdk-test/executionMapping";
const mapping = validateExecutionMapping(preset);
const run = (): ExecutionOutput => ({
  executionId: "demo",
  channel: "workflow:demo",
  status: "running",
  startedAt: "now",
  steps: { first: { status: "pending" } },
});

test("Backflow mapping preserves source and reuses execution normalizers", () => {
  const source = {
    workflow: {
      id: "test",
      steps: [
        {
          id: "first",
          type: "database",
          config: { collection: "items", operation: "select" },
        },
      ],
    },
  };
  const before = JSON.stringify(source);
  const context = prepareMappedExecution(source, { limit: 2 }, "demo", mapping);
  const body = mappingBody(mapping.actions.execute.body, context);
  assert.equal(body.executionId, "demo");
  assert.equal(body.channel, "workflow:demo");
  assert.equal(body.workflows[0].steps[0].params.collection, "items");
  assert.equal(JSON.stringify(source), before);
  assert.equal(
    mappingPath(mapping.actions.pause!.path, "demo"),
    "/agent/workflow/demo/pause",
  );
});
test("a different workflow and response shape uses JSON selectors with no Backflow adapter", () => {
  const alternate = validateExecutionMapping({
    ...preset,
    adapter: "identity",
    sourcePath: "pipeline",
    stepsPath: "jobs",
    stepIdPath: "key",
    actions: {
      execute: {
        method: "POST",
        path: "/runs",
        body: {
          pipeline: { $path: "workflow" },
          run: { $path: "executionId" },
          values: { $path: "input" },
        },
      },
    },
    response: {
      ...preset.response,
      executionId: "run",
      status: "phase",
      output: "answer",
      steps: "jobs",
      stepId: "key",
      stepStatus: "phase",
      stepOutput: "value",
    },
    events: {
      ...preset.events,
      type: "kind",
      executionId: "run",
      stepId: "job",
      output: "value",
      step: { done: "completed" },
    },
  });
  const context = prepareMappedExecution(
    { pipeline: { jobs: [{ key: "first", operation: "custom" }] } },
    {},
    "demo",
    alternate,
  );
  assert.equal(
    mappingBody(alternate.actions.execute.body, context).pipeline.jobs[0]
      .operation,
    "custom",
  );
  const output = applyExecutionEvent(
    run(),
    { kind: "done", run: "demo", job: "first", value: false },
    alternate,
  );
  assert.equal(output.steps.first.output, false);
  assert.equal(
    applyExecutionResponse(
      output,
      {
        run: "demo",
        phase: "success",
        answer: 0,
        jobs: [{ key: "first", phase: "success", value: null }],
      },
      alternate,
    ).steps.first.output,
    null,
  );
});
test("mapping validation and runtime output reject unsafe paths and foreign executions", () => {
  assert.throws(() =>
    validateExecutionMapping({ ...preset, sourcePath: "__proto__.workflow" }),
  );
  assert.throws(() => mappingPath("https://other.invalid/run", "demo"));
  assert.throws(() =>
    validateExecutionMapping({
      ...preset,
      subscription: { order: "after", channel: "run:{executionId}" },
    }),
  );
  const current = run();
  assert.equal(
    applyExecutionEvent(
      current,
      { type: "step_completed", executionId: "other", step: "first" },
      mapping,
    ),
    current,
  );
  const cancelled = { ...current, status: "cancelled" as const };
  assert.equal(
    applyExecutionResponse(
      cancelled,
      { success: true, result: { status: "success" } },
      mapping,
    ),
    cancelled,
  );
});
