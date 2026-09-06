import assert from "node:assert/strict";
import { test } from "node:test";
import workflow from "../examples/workflow-state-2/workflow.json";
import {
  CONFIGURED_EXAMPLES,
  DIAGRAM_BINDINGS,
} from "../examples/workflow-state-2/configured";

test("JSON presets preserve all source data and generate the five independent resource designs", () => {
  for (const [id, example] of Object.entries(CONFIGURED_EXAMPLES)) {
    assert.deepEqual(example.state.workflow, workflow, id);
    assert.equal(example.entries.length, workflow.steps.length);
    assert.equal(Object.keys(example.state.tools).length, 23);
    assert.equal(
      Object.keys(example.view).filter((key) => key.startsWith("tool_")).length,
      id === "tools" ? 23 : 0,
    );
    assert.equal(
      Object.keys(example.dependencyMapping!.nodes).length,
      workflow.steps.length,
    );
    assert.equal(
      example.dependencyMapping!.dependencyField,
      DIAGRAM_BINDINGS.dependencies!.field,
    );
  }
  assert.notEqual(
    CONFIGURED_EXAMPLES.full.state,
    CONFIGURED_EXAMPLES.minimal.state,
  );
});
