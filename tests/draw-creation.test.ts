import assert from "node:assert/strict";
import test from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import {
  compileSqueed,
  getNode,
  type SqueedJson,
} from "../src/core/squeedEdits";

test("the first Array draw creates two siblings once per origin and survives reload", () => {
  let json: SqueedJson = {
    $hideRoot: true,
    origin: { $view: "text", $label: "Origin" },
    other: { $view: "text" },
  };
  let saves = 0;
  const draw = (sourceNodeId: string, isArrayMode = true) => {
    const callbacks = bindSqueedCallbacks(
      json,
      compileSqueed(json).edges,
      {},
      (next) => {
        json = next;
        saves++;
      },
    );
    callbacks.onNodeCreate!({
      type: "text",
      sourceNodeId,
      position: { x: 0, y: 0 },
      isArrayMode,
    });
  };
  const childIds = (source: string) =>
    compileSqueed(json)
      .nodes.map((node) => node.data.id)
      .filter((id) => id.startsWith(`${source}.`));
  draw("root.origin", false);
  assert.equal(childIds("root.origin").length, 1);
  draw("root.origin");
  assert.equal(childIds("root.origin").length, 3);
  assert.equal(saves, 2);
  assert.equal(getNode(json, "root.origin").$arrayDrawInitialized, true);
  json = JSON.parse(JSON.stringify(json));
  draw("root.origin");
  assert.equal(childIds("root.origin").length, 4);
  draw("root.other");
  assert.equal(childIds("root.other").length, 2);
  delete json.origin.list_1;
  delete json.origin.list_2;
  delete json.origin.list_3;
  draw("root.origin");
  assert.equal(childIds("root.origin").length, 2);
});

test("Array draws from arrays retain numeric sibling addresses", () => {
  let json: SqueedJson = { origin: [] };
  const callbacks = bindSqueedCallbacks(json, [], {}, (next) => {
    json = next;
  });
  callbacks.onNodeCreate!({
    type: "text",
    sourceNodeId: "root.origin",
    position: { x: 0, y: 0 },
    isArrayMode: true,
  });
  assert.ok(getNode(json, "root.origin.0"));
  assert.ok(getNode(json, "root.origin.1"));
  assert.deepEqual(
    compileSqueed(json)
      .nodes.map((node) => node.data.id)
      .filter((id) => id.startsWith("root.origin.")),
    ["root.origin.0.0", "root.origin.1.0"],
  );
  callbacks.onNodeCreate!({
    type: "text",
    sourceNodeId: "root.origin",
    position: { x: 0, y: 0 },
    isArrayMode: true,
  });
  assert.ok(getNode(json, "root.origin.2"));
  assert.equal(getNode(json, "root.origin.3"), undefined);
});
