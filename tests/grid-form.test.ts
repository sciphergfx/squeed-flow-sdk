import assert from "node:assert/strict";
import test from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";

test("Grid subtitle edits preserve identity, frame and connections", () => {
  const original = {
    grid: {
      $view: "grid",
      $document: "document",
      $subtitle: "Independent document",
      $gridSize: { width: 600, height: 440 },
      $connections: [{ target: "root.other" }],
    },
    other: {},
  };
  let saved: any;
  let notified: unknown;
  const callbacks = bindSqueedCallbacks(
    original,
    [],
    {
      onNodeSubtitleChange: (...args) => {
        notified = args;
      },
    },
    (next) => {
      saved = next;
    },
  );
  callbacks.onNodeSubtitleChange!("root.grid", "My workspace");
  assert.deepEqual(notified, ["root.grid", "My workspace"]);
  assert.deepEqual(saved, {
    ...original,
    grid: { ...original.grid, $subtitle: "My workspace" },
  });
  callbacks.onNodeSubtitleChange!("root.grid", "");
  assert.equal(Object.hasOwn(saved.grid, "$subtitle"), false);
  assert.equal(original.grid.$subtitle, "Independent document");
});
