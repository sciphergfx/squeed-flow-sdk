import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import { getNodeBorderProps } from "../src/nodes/nodeBorder";
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

test("selection uses a shadow without replacing configured node borders", () => {
  for (const viewProps of [undefined, { borderColor: "teal.500", borderStyle: "dashed" as const, borderWidth: 6 }]) {
    const selected = getNodeBorderProps(viewProps, "#008080", true, 2);
    const idle = getNodeBorderProps(viewProps, "#008080", false, 2);
    assert.equal(selected.borderColor, idle.borderColor);
    assert.equal(selected.borderWidth, idle.borderWidth);
    assert.equal(selected.borderStyle, idle.borderStyle);
    assert.equal("outline" in selected, false);
    assert.match(selected.boxShadow, /0 0 0 8px/);
    assert.match(idle.boxShadow, /0 0 0 0px/);
    assert.match(selected.css["--flow-hover-shadow"], /0 0 0 18px/);
    assert.equal(idle.css["--flow-rest-shadow"], selected.boxShadow);
    assert.equal(idle.css["--flow-hover-shadow"], selected.css["--flow-hover-shadow"]);
    const selectedHover = selected.css["@media (hover: hover)"][".flow-sdk-node:hover &"];
    const idleHover = idle.css["@media (hover: hover)"][".flow-sdk-node:hover &"];
    assert.equal(idleHover.boxShadow, selected.boxShadow);
    assert.equal(selectedHover["@media (prefers-reduced-motion: no-preference)"].animation, "none");
    assert.match(idleHover["@media (prefers-reduced-motion: no-preference)"].animation, /1200ms steps\(10, end\) 600ms/);
  }
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
