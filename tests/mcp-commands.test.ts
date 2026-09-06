import assert from "node:assert/strict";
import { test } from "node:test";
import { FLOW_COMMANDS, commandSchema } from "../examples/mcp/commands";

test("command catalog has unique routes and closed, execution-scoped inputs", () => {
  assert.equal(
    new Set(FLOW_COMMANDS.map((command) => command.name)).size,
    FLOW_COMMANDS.length,
  );
  for (const command of FLOW_COMMANDS) {
    assert.match(command.name, /^[a-z]+(?:-[a-z]+)*$/);
    const schema = commandSchema(command);
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.required.includes("executionId"));
    for (const field of schema.required)
      assert.ok(schema.properties[field], `${command.name}: ${field}`);
  }
});

test("legacy node commands retain their existing route names and fields", () => {
  assert.deepEqual(
    Object.keys(
      FLOW_COMMANDS.find((command) => command.name === "node-view")!.fields,
    ),
    ["mode"],
  );
  assert.deepEqual(
    Object.keys(
      FLOW_COMMANDS.find((command) => command.name === "node-animation")!
        .fields,
    ),
    ["animated"],
  );
});
