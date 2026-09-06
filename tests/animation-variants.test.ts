import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import { compileSqueed, type SqueedJson } from "../src/core/squeedEdits";

test("node variants preserve enable flags, colors and array identities", () => {
  const original = {
    tags: ["First"],
    other: { $isNodeAnimated: true, $bgColor: "teal.500" },
  };
  let document: SqueedJson = original;
  const graph = compileSqueed(document);
  const events: unknown[] = [];
  const callbacks = bindSqueedCallbacks(
    document,
    graph.edges,
    {
      onNodeAnimationVariantChange: (...args) => events.push(args),
    },
    (next) => {
      document = next;
    },
  );
  callbacks.onNodeAnimationVariantChange!("root.tags.0", "pulse");
  callbacks.onNodeAnimationVariantChange!("root.other", "traveling");
  const next = compileSqueed(document);
  assert.deepEqual(
    next.nodes.map((node) => node.data.id),
    graph.nodes.map((node) => node.data.id),
  );
  assert.deepEqual(next.edges, graph.edges);
  assert.equal(
    next.nodes.find((node) => node.data.id === "root.tags.0")!.data
      .nodeAnimationVariant,
    "pulse",
  );
  assert.equal(document.other.$isNodeAnimated, true);
  assert.equal(document.other.$bgColor, "teal.500");
  assert.deepEqual(events, [
    ["root.tags.0", "pulse"],
    ["root.other", "traveling"],
  ]);
  assert.deepEqual(original, {
    tags: ["First"],
    other: { $isNodeAnimated: true, $bgColor: "teal.500" },
  });
});

for (const kind of ["hierarchy", "target", "connection"] as const) {
  test(`${kind} edge variants round trip independently of enable flags and neighboring edges`, () => {
    let document: SqueedJson =
      kind === "hierarchy"
        ? { source: { child: { $isEdgeAnimated: true } } }
        : kind === "target"
          ? {
              source: { $target: "root.target", $isEdgeAnimated: true },
              target: {},
            }
          : {
              source: {
                $connections: [
                  {
                    id: "first",
                    target: "root.target",
                    style: "animated",
                    color: "teal.500",
                  },
                  {
                    id: "second",
                    target: "root.target",
                    sourceProperty: "value",
                  },
                ],
              },
              target: {},
            };
    const graph = compileSqueed(document);
    const edge = graph.edges.find((edge) => edge.data.isEdgeAnimated)!;
    const callbacks = bindSqueedCallbacks(document, graph.edges, {}, (next) => {
      document = next;
    });
    callbacks.onEdgeAnimationVariantChange!(edge.data.id, "traveling");
    assert.equal(
      compileSqueed(document).edges.find(
        (next) => next.data.id === edge.data.id,
      )!.data.edgeAnimationVariant,
      "traveling",
    );
    callbacks.onEdgeStyleChange!(edge.data.id, "solid");
    callbacks.onEdgeStyleChange!(edge.data.id, "animated");
    const next = compileSqueed(document);
    assert.equal(
      next.edges.find((next) => next.data.id === edge.data.id)!.data
        .edgeAnimationVariant,
      "traveling",
    );
    assert.equal(
      next.edges.find((next) => next.data.id === edge.data.id)!.data
        .isEdgeAnimated,
      true,
    );
    assert.deepEqual(
      next.edges.filter((next) => next.data.id !== edge.data.id),
      graph.edges.filter((next) => next.data.id !== edge.data.id),
    );
    callbacks.onEdgeAnimationVariantChange!(edge.data.id, "dashed");
    assert.equal(
      compileSqueed(document).edges.find(
        (next) => next.data.id === edge.data.id,
      )!.data.edgeAnimationVariant,
      "dashed",
    );
  });
}

test("unknown animation variants do not notify or mutate a document", () => {
  const callbacks = bindSqueedCallbacks(
    {},
    [],
    {
      onNodeAnimationVariantChange: () => assert.fail("invalid node variant"),
      onEdgeAnimationVariantChange: () => assert.fail("invalid edge variant"),
    },
    () => assert.fail("invalid document update"),
  );
  callbacks.onNodeAnimationVariantChange!("root", "invalid" as never);
  callbacks.onEdgeAnimationVariantChange!("edge", "invalid" as never);
});
