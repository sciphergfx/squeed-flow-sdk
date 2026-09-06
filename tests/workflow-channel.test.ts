import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("Squeed MCP provision emits supported scoped node commands", () => {
  const manifest = JSON.parse(
    readFileSync(
      "../../backflow/backflow-video/.backflow/squeed/provision.json",
      "utf8",
    ),
  );
  assert.ok(manifest.routes.length > 2);
  const mapping = {
    nodes: { external: "root.external" },
    rules: WORKFLOW_EVENT_RULES,
  };
  for (const route of manifest.routes.filter(route => ["/squeed/node-view", "/squeed/node-animation"].includes(route.path))) {
    assert.equal(route.requireAuth, true);
    assert.equal(route.mcpEnabled, true);
    assert.equal(route.cache.enabled, false);
    const action = route.integrations.actions[0];
    assert.equal(action.input.executionId, "{{body.executionId}}");
    const workflow = manifest.workflows.find(
      (workflow) => workflow.id === action.workflowId,
    );
    assert.equal(workflow.steps[0].action, "emit_event");
    const type = workflow.steps[0].params.event;
    const data = {
      executionId: "demo-session",
      node: "external",
      mode: "properties",
      animated: true,
    };
    const envelope = { type, data, timestamp: "2026-09-06T00:00:00.000Z" };
    assert.equal(mapWorkflowEvent(envelope, "demo-session", mapping).length, 1);
    assert.deepEqual(mapWorkflowEvent(envelope, "other-session", mapping), []);
    assert.deepEqual(
      mapWorkflowEvent(
        { ...envelope, executionId: "other-session" },
        "demo-session",
        mapping,
      ),
      [],
    );
    assert.deepEqual(
      mapWorkflowEvent(
        { ...envelope, data: { ...data, node: "unknown" } },
        "demo-session",
        mapping,
      ),
      [],
    );
  }
});

test("nested MCP commands reject missing scopes, malformed payloads and invalid values", () => {
  const mapping = {
    nodes: { external: "root.external" },
    rules: WORKFLOW_EVENT_RULES,
  };
  const data = {
    executionId: "demo-session",
    node: "external",
    mode: "properties",
  };
  for (const payload of [
    null,
    false,
    "invalid",
    [],
    {},
    { ...data, executionId: undefined },
    { ...data, executionId: "other-session" },
    { ...data, mode: "execute" },
    { ...data, node: "__proto__" },
  ]) {
    assert.deepEqual(
      mapWorkflowEvent(
        { type: "mcp_node_view", ...data, data: payload },
        "demo-session",
        mapping,
      ),
      [],
    );
  }
  for (const animated of [true, false]) {
    assert.deepEqual(
      mapWorkflowEvent(
        { type: "mcp_node_animation", data: { ...data, animated } },
        "demo-session",
        mapping,
      ),
      [{ nodeId: "root.external", action: "animation", value: animated }],
    );
  }
  for (const animated of ["true", 1, null]) {
    assert.deepEqual(
      mapWorkflowEvent(
        { type: "mcp_node_animation", data: { ...data, animated } },
        "demo-session",
        mapping,
      ),
      [],
    );
  }
});
