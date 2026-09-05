import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import { compileSqueed, setNodeProp, type SqueedJson } from "../src/core/squeedEdits";

test("outline compiles without changing saved colors or graph addresses", () => {
  const original = { node: { $label: "Node", $bgColor: "teal.500", $textColor: "white", $borderColor: "red.500" } };
  const initial = compileSqueed(original);
  const outlined = setNodeProp(original, "root.node", "$outline", true);
  const graph = compileSqueed(outlined);
  assert.deepEqual(graph.nodes.map((node) => node.data.id), initial.nodes.map((node) => node.data.id));
  assert.deepEqual(graph.nodes.find((node) => node.data.id === "root.node")!.data.viewProps, {
    ...initial.nodes.find((node) => node.data.id === "root.node")!.data.viewProps, outline: true,
  });
  assert.equal(compileSqueed(setNodeProp(outlined, "root.node", "$outline", false)).nodes.find((node) => node.data.id === "root.node")!.data.viewProps.outline, false);
  assert.deepEqual(setNodeProp(outlined, "root.node", "$outline", undefined), original);
});

test("batched outline callbacks persist each node and notify before JSON changes", () => {
  const original = { first: { $bgColor: "blue.500" }, second: { $bgColor: "green.500" } };
  let latest: SqueedJson = original;
  const events: unknown[] = [];
  const callbacks = bindSqueedCallbacks(original, [], {
    onNodeOutlineChange: (id, value) => events.push([id, value]),
  }, (next, change) => { latest = next; events.push(change.type); });
  callbacks.onNodeOutlineChange!("root.first", true);
  callbacks.onNodeOutlineChange!("root.second", true);
  assert.deepEqual(latest, { first: { $bgColor: "blue.500", $outline: true }, second: { $bgColor: "green.500", $outline: true } });
  assert.deepEqual(events, [["root.first", true], "nodeOutline", ["root.second", true], "nodeOutline"]);
  assert.equal("$outline" in original.first, false);
});

test("outline metadata on an array-string node keeps it addressable", () => {
  const original = { tags: ["beta", "stable"] };
  const outlined = setNodeProp(original, "root.tags.1", "$outline", true);
  const node = compileSqueed(outlined).nodes.find((node) => node.data.id === "root.tags.1")!;
  assert.equal(node.data.label, "stable");
  assert.equal(node.data.viewProps.outline, true);
});