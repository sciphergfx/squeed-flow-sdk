import assert from "node:assert/strict";
import { test } from "node:test";
import { compileSqueed, setNodeProp } from "../src/core/squeedEdits";
import { isColorOnlyUpdate, recolorGraph } from "../src/core/recolorGraph";

test("color-only updates preserve untouched nodes and edges and match compilation", () => {
  const data = { alpha: { name: "A" }, beta: { name: "B" } };
  const graph = compileSqueed(data);
  const next = setNodeProp(data, "root.alpha", "$bgColor", "teal.500");
  const result = recolorGraph(data, next, graph)!;
  assert.ok(result);
  assert.equal(result.edges, graph.edges);
  assert.equal(
    result.nodes.find((node) => node.data.id === "root.beta"),
    graph.nodes.find((node) => node.data.id === "root.beta"),
  );
  const expected = compileSqueed(next);
  assert.deepEqual(result.nodes, expected.nodes);
  assert.equal(
    recolorGraph(data, { ...data, alpha: { name: "Changed" } }, graph),
    undefined,
  );
  assert.equal(recolorGraph(next, data, result), undefined);
});

test("color detection permits cloned view metadata but rejects value and graph edits", () => {
  const data = {
    alpha: {
      $label: { $state: "root.name" },
      $ports: [{ id: "output", side: "right" }],
      $connections: [{ target: "root.beta" }],
    },
    beta: { name: "B" },
  };
  const next = {
    ...structuredClone(data),
    alpha: { ...structuredClone(data.alpha), $bgColor: "teal.500" },
  };
  assert.equal(isColorOnlyUpdate(data, next), true);
  const graph = compileSqueed({
    ...data,
    alpha: { ...data.alpha, $label: "Alpha" },
  });
  assert.equal(recolorGraph(data, next, graph)?.edges, graph.edges);
  assert.equal(
    isColorOnlyUpdate(data, { ...next, beta: { name: "Changed" } }),
    false,
  );
  assert.equal(
    isColorOnlyUpdate(data, {
      ...next,
      alpha: { ...next.alpha, $ports: [{ id: "input", side: "left" }] },
    }),
    false,
  );
  assert.equal(
    isColorOnlyUpdate(data, {
      ...next,
      alpha: { ...next.alpha, $connections: [] },
    }),
    false,
  );
});
