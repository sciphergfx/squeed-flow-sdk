import assert from "node:assert/strict";
import { test } from "node:test";
import { compileSqueed, setEdgeProp } from "../src/core/squeedEdits";

test("edge shapes round trip independently for hierarchy, target and parallel connections", () => {
  const original = {
    first: {
      $label: "First",
      $target: "root.second",
      $connections: [
        {
          id: "one",
          target: "root.second",
          style: "animated",
          color: "red.500",
        },
        { id: "two", target: "root.second", label: "Second mapping" },
      ],
    },
    second: { $label: "Second" },
  };
  const graph = compileSqueed(original);
  for (const selected of graph.edges) {
    const next = setEdgeProp(
      original,
      selected.data,
      "$edgeType",
      "custom-curve",
    );
    const result = compileSqueed(next);
    assert.deepEqual(
      result.edges.map((edge) => [edge.data.id, edge.data.type]),
      graph.edges.map((edge) => [
        edge.data.id,
        edge.data.id === selected.data.id ? "custom-curve" : undefined,
      ]),
    );
    const changed = result.edges.find(
      (edge) => edge.data.id === selected.data.id,
    )!;
    assert.deepEqual(
      { ...changed.data, type: undefined },
      { ...selected.data, type: undefined },
    );
    assert.deepEqual(
      setEdgeProp(next, changed.data, "$edgeType", undefined),
      original,
    );
  }
});
