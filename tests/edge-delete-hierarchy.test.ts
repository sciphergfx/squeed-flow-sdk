import assert from "node:assert/strict";
import { test } from "node:test";
import { compileSqueed, removeEdge } from "../src/core/squeedEdits";

test("hierarchy edges can be deleted without removing their nodes", () => {
  const view = { parent: { child: { value: "kept" } } };
  const graph = compileSqueed(view);
  const edge = graph.edges.find(
    (entry) =>
      entry.data.source === "root.parent" &&
      entry.data.target === "root.parent.child",
  )!;
  assert.ok(edge);
  const result = removeEdge(view, edge.data);
  assert.equal(result.removed, true);
  const next = compileSqueed(result.json);
  assert.ok(next.nodes.some((node) => node.data.id === "root.parent.child"));
  assert.equal(
    next.edges.some(
      (entry) =>
        entry.data.source === edge.data.source &&
        entry.data.target === edge.data.target,
    ),
    false,
  );
  assert.equal(result.json.parent.child.value, "kept");
  assert.equal(view.parent.child.value, "kept");
});

test("manual diagrams can hide the implicit root and its edges", () => {
  const graph = compileSqueed({
    $hideRoot: true,
    source: { $label: "Source" },
    target: { $label: "Target" },
  });
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 0);
});
