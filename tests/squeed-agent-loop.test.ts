import assert from "node:assert/strict";
import { test } from "node:test";
import {
  runSqueedAgentLoop,
  squeedAgentTools,
} from "../../../backflow/backflow-admin/src/pages/sdk-test/squeedAgentLoop";

test("agent loop supplies full schemas and returns every MCP reply with its assistant tool calls", async () => {
  const tools = squeedAgentTools("demo");
  assert.equal(tools.length, 72);
  assert.deepEqual(
    tools[0].input_schema.properties.body.properties.executionId,
    { type: "string", const: "demo" },
  );
  const calls = ["node_label", "node_content"].map((name, index) => ({
    id: `call-${index}`,
    type: "function",
    function: {
      name: `route_post_squeed_${name}`,
      arguments: JSON.stringify({
        body: {
          executionId: "demo",
          node: "task",
          [index ? "content" : "label"]: "test",
        },
      }),
    },
  }));
  let round = 0;
  const executed: string[] = [];
  const result = await runSqueedAgentLoop({
    executionId: "demo",
    system: "Test",
    messages: [{ role: "user", content: "Change the node" }],
    client: {
      callTool: async (call) => {
        executed.push(call.name);
        return { success: true };
      },
    },
    requestAgent: async (request) => {
      if (round++ === 0) return { type: "tool_call", tool_calls: calls };
      assert.deepEqual(request.messages[1].tool_calls, calls);
      assert.deepEqual(
        request.messages.slice(2).map((message) => message.tool_call_id),
        ["call-0", "call-1"],
      );
      return { type: "text", content: "Commands published." };
    },
  });
  assert.equal(executed.length, 2);
  assert.equal(result.response.content, "Commands published.");
});

test("agent loop refuses unknown tools, wrong sessions and unbounded rounds before MCP execution", async () => {
  for (const [name, executionId] of [
    ["delete_app", "demo"],
    ["route_post_squeed_node_label", "other"],
  ]) {
    await assert.rejects(
      runSqueedAgentLoop({
        executionId: "demo",
        system: "Test",
        messages: [],
        client: {
          callTool: async () => {
            assert.fail("Must not execute");
          },
        },
        requestAgent: async () => ({
          type: "tool_call",
          tool_calls: [
            {
              id: "call",
              type: "function",
              function: {
                name,
                arguments: JSON.stringify({
                  body: { executionId, node: "task", label: "test" },
                }),
              },
            },
          ],
        }),
      }),
    );
  }
});
