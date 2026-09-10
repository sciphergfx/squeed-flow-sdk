import assert from "node:assert/strict";
import test from "node:test";
import {
  copySelection,
  duplicateSelection,
  getSelectionRoots,
  reparentNode,
} from "../src/core/selectionEdits";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";

test("copy and duplicate include parent children and only internal edges", () => {
  const json = {
    group: { $view: "parent", $label: "Parent" },
    first: {
      $parent: "root.group",
      $borderRadius: 12,
      $connections: [{ target: "root.second" }, { target: "root.outside" }],
    },
    second: { $parent: "root.group", nested: { value: 42 } },
    outside: { value: true },
  };
  const before = structuredClone(json);
  assert.deepEqual(getSelectionRoots(json, ["root.group"]), [
    "root.group",
    "root.first",
    "root.second",
  ]);
  const copied = copySelection(json, ["root.group", "root.first"]);
  assert.equal(Object.keys(copied).length, 4);
  assert.equal(copied.node_2.$connections.length, 1);
  assert.equal(copied.node_2.$parent, "root.node_1");
  const duplicated = duplicateSelection(json, ["root.group"]);
  assert.equal(duplicated.ids.length, 3);
  const copies = duplicated.ids.map((id) => duplicated.json[id.slice(5)]);
  assert.equal(copies[1].$connections[0].target, duplicated.ids[2]);
  assert.equal(copies[2].nested.value, 42);
  assert.equal(copies[1].$borderRadius, 12);
  assert.deepEqual(json, before);
});

test("reparent preserves IDs and connections and rejects containment cycles", () => {
  const json = {
    parent: { $view: "parent" },
    child: { $parent: "root.parent" },
    other: { $connections: [{ target: "root.child" }] },
  };
  const moved = reparentNode(json, "root.other", "root.parent");
  assert.equal(moved.other.$parent, "root.parent");
  assert.deepEqual(moved.other.$connections, json.other.$connections);
  assert.throws(
    () => reparentNode(json, "root.parent", "root.child"),
    /descendants/,
  );
  assert.throws(
    () => reparentNode(json, "root.parent", "root.parent"),
    /descendants/,
  );
  assert.throws(
    () =>
      reparentNode(
        { parent: { child: {} } },
        "root.parent",
        "root.parent.child",
      ),
    /descendants/,
  );
  assert.equal((json.other as any).$parent, undefined);
});

test("Parent drops use JSON binding and handled creation skips default insertion", () => {
  const json = { parent: { $view: "parent" }, child: { $label: "Child" } };
  let result: any;
  let creations = 0;
  const callbacks = bindSqueedCallbacks(
    json,
    [],
    {
      onNodeCreate: () => {
        creations++;
        return true;
      },
    },
    (next) => {
      result = next;
    },
  );
  callbacks.onNodeCreate!({ type: "text", position: { x: 0, y: 0 } });
  assert.equal(creations, 1);
  assert.equal(result, undefined);
  callbacks.onNodeParentChange!("root.child", "root.parent");
  assert.equal(result.child.$parent, "root.parent");
  assert.equal(result.child.$label, "Child");
});
