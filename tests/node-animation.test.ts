import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import {
  compileSqueed,
  setNodeProp,
  type SqueedJson,
} from "../src/core/squeedEdits";

test("node animation metadata round trips independently from edges and colors", () => {
  const original = {
    node: {
      $label: "Node",
      $bgColor: "teal.500",
      $outline: true,
      $isEdgeAnimated: true,
    },
  };
  const initial = compileSqueed(original);
  const next = setNodeProp(original, "root.node", "$isNodeAnimated", true);
  const graph = compileSqueed(next);
  assert.equal(
    graph.nodes.find((node) => node.data.id === "root.node")!.data
      .isNodeAnimated,
    true,
  );
  assert.deepEqual(graph.edges, initial.edges);
  assert.deepEqual(next.node, { ...original.node, $isNodeAnimated: true });
  assert.equal(
    compileSqueed(
      setNodeProp(next, "root.node", "$isNodeAnimated", false),
    ).nodes.find((node) => node.data.id === "root.node")!.data.isNodeAnimated,
    false,
  );
  assert.deepEqual(
    setNodeProp(next, "root.node", "$isNodeAnimated", undefined),
    original,
  );
});

test("batched node animation callbacks preserve both updates and their notification order", () => {
  const original = { first: {}, second: {} };
  let latest: SqueedJson = original;
  const events: unknown[] = [];
  const callbacks = bindSqueedCallbacks(
    original,
    [],
    {
      onNodeAnimationChange: (id, animated) => events.push([id, animated]),
    },
    (next, change) => {
      latest = next;
      events.push(change.type);
    },
  );
  callbacks.onNodeAnimationChange!("root.first", true);
  callbacks.onNodeAnimationChange!("root.second", true);
  assert.deepEqual(latest, {
    first: { $isNodeAnimated: true },
    second: { $isNodeAnimated: true },
  });
  assert.deepEqual(events, [
    ["root.first", true],
    "nodeAnimation",
    ["root.second", true],
    "nodeAnimation",
  ]);
  assert.deepEqual(original, { first: {}, second: {} });
});

test("animation on a string-array node preserves its address and mapping", () => {
  const original = {
    tags: ["beta"],
    source: { $connections: [{ target: "root.tags.0" }] },
  };
  const initial = compileSqueed(original);
  const graph = compileSqueed(
    setNodeProp(original, "root.tags.0", "$isNodeAnimated", true),
  );
  assert.deepEqual(
    graph.nodes.map((node) => node.data.id),
    initial.nodes.map((node) => node.data.id),
  );
  assert.deepEqual(
    graph.edges.map((edge) => edge.data.id),
    initial.edges.map((edge) => edge.data.id),
  );
  assert.equal(
    graph.nodes.find((node) => node.data.id === "root.tags.0")!.data
      .isNodeAnimated,
    true,
  );
});
