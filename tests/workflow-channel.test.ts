import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapWorkflowEvent,
  workflowChannel,
  WORKFLOW_EVENT_RULES,
} from "../../../backflow/backflow-admin/src/pages/sdk-test/workflowChannel";

test("client workflow channel maps scoped step and MCP events to allowed node actions", () => {
  const mapping = {
    nodes: { externalTask: "root.arbitrary" },
    rules: WORKFLOW_EVENT_RULES,
  };
  assert.equal(workflowChannel("exec-123"), "workflow:exec-123");
  assert.throws(() => workflowChannel("../wrong"));
  assert.deepEqual(
    mapWorkflowEvent(
      { type: "step_started", executionId: "exec-123", step: "externalTask" },
      "exec-123",
      mapping,
    ),
    [{ nodeId: "root.arbitrary", action: "animation", value: true }],
  );
  assert.deepEqual(
    mapWorkflowEvent(
      { type: "workflow_completed", executionId: "exec-123" },
      "exec-123",
      mapping,
    ),
    [{ nodeId: "root.arbitrary", action: "animation", value: false }],
  );
  assert.deepEqual(
    mapWorkflowEvent(
      {
        type: "mcp_node_view",
        executionId: "exec-123",
        node: "externalTask",
        mode: "properties",
      },
      "exec-123",
      mapping,
    ),
    [{ nodeId: "root.arbitrary", action: "view", value: "properties" }],
  );
  for (const event of [
    { type: "step_started", executionId: "other", step: "externalTask" },
    { type: "step_started", step: "externalTask" },
    { type: "step_started", executionId: "exec-123", step: "unknown" },
    {
      type: "mcp_node_view",
      executionId: "exec-123",
      node: "externalTask",
      mode: "execute",
    },
  ])
    assert.deepEqual(mapWorkflowEvent(event, "exec-123", mapping), []);
});
