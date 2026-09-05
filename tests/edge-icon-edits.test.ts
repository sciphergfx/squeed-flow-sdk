import assert from "node:assert/strict";
import test from "node:test";
import { compileSqueed, setEdgeProp } from "../src/core/squeedEdits";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";

test("edge icons persist and reset independently for every edge owner", () => {
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
    const next = setEdgeProp(original, selected.data, "$edgeIcon", "PiGear");
    const result = compileSqueed(next);
    assert.deepEqual(
      result.edges.map((edge) => [edge.data.id, edge.data.icon]),
      graph.edges.map((edge) => [
        edge.data.id,
        edge.data.id === selected.data.id ? "PiGear" : undefined,
      ]),
    );
    const changed = result.edges.find(
      (edge) => edge.data.id === selected.data.id,
    )!;
    assert.deepEqual(
      { ...changed.data, icon: undefined },
      { ...selected.data, icon: undefined },
    );
    assert.deepEqual(
      setEdgeProp(next, changed.data, "$edgeIcon", undefined),
      original,
    );
    let document = next;
    const events: string[] = [];
    const callbacks = bindSqueedCallbacks(
      next,
      result.edges,
      { onEdgeIconChange: () => events.push("icon") },
      (value) => {
        document = value;
        events.push("json");
      },
    );
    callbacks.onEdgeIconChange!(selected.data.id, "");
    assert.deepEqual(document, original);
    assert.deepEqual(events, ["icon", "json"]);
  }
});
