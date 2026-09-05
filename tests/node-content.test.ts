import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import {
  compileSqueed,
  setNodeProp,
  type SqueedJson,
} from "../src/core/squeedEdits";

test("content updates retain whitespace, empty text and sibling references", () => {
  const original = {
    runbook: { $label: "Runbook", $content: "Original" },
    other: { value: 1 },
  };
  let latest: SqueedJson = original;
  const events: unknown[] = [];
  const callbacks = bindSqueedCallbacks(
    original,
    [],
    {
      onNodeContentChange: (id, content) => events.push([id, content]),
    },
    (next, change) => {
      latest = next;
      events.push(change.type);
    },
  );
  for (const content of ["  First\n\nSecond  ", ""]) {
    callbacks.onNodeContentChange!("root.runbook", content);
    assert.equal(latest.runbook.$content, content);
    assert.equal(latest.other, original.other);
    const node = compileSqueed(latest).nodes.find(
      (node) => node.data.id === "root.runbook",
    )!;
    assert.equal(node.data.type, "objectView");
    assert.equal(node.data.config?.content, content);
  }
  assert.deepEqual(events, [
    ["root.runbook", "  First\n\nSecond  "],
    "nodeContent",
    ["root.runbook", ""],
    "nodeContent",
  ]);
  assert.equal(original.runbook.$content, "Original");
  assert.equal(
    setNodeProp(latest, "root.runbook", "$content", undefined).runbook.$content,
    undefined,
  );
});
