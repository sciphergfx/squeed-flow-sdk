import assert from "node:assert/strict";
import { test } from "node:test";
import { connectedNodeIds } from "../src/engine/connectedNodeIds";

test("connection focus includes direct inputs and outputs, not unrelated or transitive nodes", () => {
  const nodes = ["input", "selected", "output", "next", "unrelated"].map(id => ({ id }));
  const edges = [{ source: "input", target: "selected" }, { source: "selected", target: "output" }, { source: "output", target: "next" }, { source: "selected", target: "missing" }];
  assert.deepEqual([...connectedNodeIds("selected", nodes, edges)].sort(), ["input", "output", "selected"]);
  assert.equal(connectedNodeIds("missing", nodes, edges).size, 0);
});

test("parent connection focus includes descendants and their external connections", () => {
  const nodes = [{ id: "group" }, { id: "child", parent: "group" }, { id: "nested", parent: "child" }, { id: "group.named" }, { id: "outside" }, { id: "unrelated" }];
  assert.deepEqual([...connectedNodeIds("group", nodes, [{ source: "outside", target: "nested" }])].sort(), ["child", "group", "group.named", "nested", "outside"]);
});