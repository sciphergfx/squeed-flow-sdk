import assert from "node:assert/strict";
import { test } from "node:test";
import { createDiagramGeneration } from "../../../backflow/backflow-admin/src/pages/sdk-test/diagramGeneration";
import {
  generationRoute,
  generationWorkflow,
} from "../examples/mcp/generation";

test("generation uses a dedicated uncached workflow with inherited models and bounded output", () => {
  assert.equal(generationRoute.requireAuth, true);
  assert.equal(generationRoute.cache.enabled, false);
  assert.equal(generationWorkflow.steps[1].action, "llm");
  assert.equal(generationWorkflow.steps[1].params.maxTokens, 8192);
  assert.equal(generationWorkflow.steps[1].params.streamPreview, true);
  assert.equal("apiKey" in generationWorkflow.steps[1].params, false);
});
test("scoped cumulative snapshots preview once and commit only after matching completion", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const previews: unknown[] = [],
    commits: unknown[] = [],
    statuses: string[] = [];
  const generation = createDiagramGeneration({
    executionId: "demo",
    preview: (value) => previews.push(value),
    commit: (value) => commits.push(value),
    status: (status) => statuses.push(status),
  });
  const event = (type: string, data = {}) => ({
    type,
    executionId: "demo",
    data,
  });
  assert.equal(
    generation.receive({
      type: "squeed_generation_started",
      executionId: "other",
      data: { requestId: "first" },
    }),
    false,
  );
  generation.receive(
    event("llm_output_chunk", { chunk: "{}", length: 2, complete: true }),
  );
  assert.equal(previews.length, 0);
  generation.receive(
    event("squeed_generation_started", { requestId: "first" }),
  );
  generation.receive(
    event("llm_output_chunk", { chunk: '{"node":{', length: 9 }),
  );
  const source = '{"node":{"$label":"Hello"}}';
  generation.receive(
    event("llm_output_chunk", {
      chunk: source,
      length: source.length,
      complete: true,
    }),
  );
  context.mock.timers.tick(150);
  assert.deepEqual(previews, [{ node: { $label: "Hello" } }]);
  assert.equal(commits.length, 0);
  generation.receive(
    event("squeed_generation_completed", { requestId: "other" }),
  );
  assert.equal(commits.length, 0);
  generation.receive(
    event("squeed_generation_completed", { requestId: "first" }),
  );
  assert.deepEqual(commits, [{ node: { $label: "Hello" } }]);
  assert.deepEqual(statuses, ["streaming", "complete"]);
  generation.dispose();
});
test("invalid finals, failures, overlapping requests and disposal discard previews", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  for (const terminal of [
    "invalid",
    "workflow_cancelled",
    "workflow_failed",
    "overlap",
    "timeout",
    "dispose",
  ]) {
    let preview: unknown;
    const generation = createDiagramGeneration({
      executionId: "demo",
      preview: (value) => {
        preview = value;
      },
      commit: () => assert.fail("Unexpected commit"),
      status: () => {},
    });
    generation.receive({
      type: "squeed_generation_started",
      data: { executionId: "demo", requestId: "first" },
    });
    const chunk = '{"node":{';
    generation.receive({
      type: "llm_output_chunk",
      executionId: "demo",
      data: { chunk, length: chunk.length, complete: true },
    });
    context.mock.timers.tick(150);
    assert.ok(preview);
    if (terminal === "dispose") generation.dispose();
    else if (terminal === "timeout") context.mock.timers.tick(180000);
    else
      generation.receive({
        type:
          terminal === "invalid"
            ? "squeed_generation_completed"
            : terminal === "overlap"
              ? "squeed_generation_started"
              : terminal,
        executionId: "demo",
        data: { requestId: terminal === "overlap" ? "second" : "first" },
      });
    assert.equal(preview, undefined);
    generation.dispose();
  }
});
