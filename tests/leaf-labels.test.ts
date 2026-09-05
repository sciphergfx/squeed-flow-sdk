import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import { compileSqueed, type SqueedJson } from "../src/core/squeedEdits";

test("saving an array-string label keeps its address and supports a second edit", () => {
  const original = { tags: ["beta", "eu-west-1", "pci-dss"] };
  let document: SqueedJson = original;
  const initial = compileSqueed(document);
  const ids = initial.nodes.map((node) => node.data.id);
  const edgeIds = initial.edges.map((edge) => edge.data.id);
  for (const label of ["eu-central-1", "ap-south-1"]) {
    const callbacks = bindSqueedCallbacks(
      document,
      compileSqueed(document).edges,
      {},
      (next) => {
        document = next;
      },
    );
    callbacks.onNodeLabelChange!("root.tags.1", label);
    const graph = compileSqueed(document);
    assert.deepEqual(
      graph.nodes.map((node) => node.data.id),
      ids,
    );
    assert.deepEqual(
      graph.edges.map((edge) => edge.data.id),
      edgeIds,
    );
    assert.equal(
      graph.nodes.find((node) => node.data.id === "root.tags.1")?.data.label,
      label,
    );
  }
  assert.deepEqual(original, { tags: ["beta", "eu-west-1", "pci-dss"] });
});
