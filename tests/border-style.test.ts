import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import {
  compileSqueed,
  setNodeProp,
  type SqueedJson,
} from "../src/core/squeedEdits";

test("compiler defaults do not override ordinary nodes' legacy border widths", () => {
  const graph = compileSqueed({ item: { status: "ready" }, tags: ["one"] });
  for (const node of graph.nodes)
    assert.equal(node.data.viewProps?.borderWidth, undefined);
});

test("border style and width callbacks preserve fills, compose, and reset", () => {
  const original = Object.freeze({
    first: Object.freeze({
      $bgColor: "blue.500",
      $textColor: "white",
      status: "ready",
    }),
    second: Object.freeze({ $outline: true, status: "waiting" }),
  });
  let latest: SqueedJson = original;
  const events: unknown[] = [];
  const callbacks = bindSqueedCallbacks(
    original,
    [],
    {
      onNodeBorderStyleChange: (id, style) => events.push([id, style]),
      onNodeBorderWidthChange: (id, width) => events.push([id, width]),
      onNodeOutlineChange: () =>
        assert.fail("Border styling must not change fill mode"),
    },
    (next, change) => {
      latest = next;
      events.push([change.type, change.key]);
    },
  );
  callbacks.onNodeBorderStyleChange!("root.first", "dashed");
  callbacks.onNodeBorderWidthChange!("root.first", 9);
  callbacks.onNodeBorderWidthChange!("root.second", 0);
  assert.deepEqual(latest, {
    first: { ...original.first, $borderStyle: "dashed", $borderWidth: 9 },
    second: { ...original.second, $borderWidth: 0 },
  });
  assert.deepEqual(events, [
    ["root.first", "dashed"],
    ["nodeStyle", "$borderStyle"],
    ["root.first", 9],
    ["nodeStyle", "$borderWidth"],
    ["root.second", 0],
    ["nodeStyle", "$borderWidth"],
  ]);
  const compiled = compileSqueed(latest);
  const first = compiled.nodes.find((node) => node.data.id === "root.first")!;
  const second = compiled.nodes.find((node) => node.data.id === "root.second")!;
  assert.equal(first.data.viewProps.borderStyle, "dashed");
  assert.equal(first.data.viewProps.borderWidth, 9);
  assert.equal(second.data.viewProps.borderWidth, 0);
  callbacks.onNodeBorderWidthChange!("root.first", undefined);
  assert.deepEqual(latest.first, { ...original.first, $borderStyle: "dashed" });
  const beforeInvalid = latest;
  const eventCount = events.length;
  for (const width of [-1, NaN, Infinity])
    callbacks.onNodeBorderWidthChange!("root.first", width);
  assert.equal(latest, beforeInvalid);
  assert.equal(events.length, eventCount);
});

test("border styling keeps string-array addresses and mapping endpoints", () => {
  const original = {
    tags: ["first", "second"],
    source: { $target: "root.tags.1" },
  };
  const styled = setNodeProp(
    setNodeProp(original, "root.tags.1", "$borderWidth", 6),
    "root.tags.1",
    "$borderStyle",
    "dashed",
  );
  const compiled = compileSqueed(styled);
  const node = compiled.nodes.find((entry) => entry.data.id === "root.tags.1")!;
  assert.equal(node.data.viewProps.borderWidth, 6);
  assert.equal(node.data.viewProps.borderStyle, "dashed");
  assert.ok(compiled.edges.some((edge) => edge.data.target === "root.tags.1"));
  assert.deepEqual(original.tags, ["first", "second"]);
});
