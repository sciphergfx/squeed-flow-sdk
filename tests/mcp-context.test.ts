import assert from "node:assert/strict";
import { test } from "node:test";
import contexts from "../examples/mcp/context.json";

test("each context has a unique type and a complete response below the 200-byte token bound", () => {
  assert.equal(
    new Set(contexts.map((entry) => entry.type)).size,
    contexts.length,
  );
  for (const entry of contexts) {
    assert.match(entry.type, /^[a-z-]{1,24}$/);
    assert.ok(entry.context.length <= 128, entry.type);
    assert.match(entry.context, /^[\x20-\x21\x23-\x5b\x5d-\x7e]+$/);
    assert.ok(
      Buffer.byteLength(JSON.stringify(entry), "utf8") < 200,
      entry.type,
    );
  }
});
