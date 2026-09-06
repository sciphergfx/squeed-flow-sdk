import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveConfigPortRows } from "../src/engine/configPortLayout";
import type { PropertyRow } from "../src/engine/propertyRows";

const rows: PropertyRow[] = [
  {
    property: "tools",
    top: 0,
    height: 0,
    role: "target",
    placement: "config",
    anchor: { x: 50, y: 0, side: "top" },
  },
  {
    property: "model",
    top: 0,
    height: 0,
    role: "target",
    placement: "config",
    anchor: { x: 50, y: 0, side: "top" },
  },
  {
    property: "input",
    top: 50,
    height: 0,
    role: "target",
    anchor: { x: 0, y: 50, side: "left" },
  },
  {
    property: "output",
    top: 50,
    height: 0,
    role: "source",
    anchor: { x: 100, y: 50, side: "right" },
  },
];

test("config anchors choose top/bottom from peers without changing fixed input/output or arrays", () => {
  const boxes = new Map([
    ["agent", { x: 0, y: 0, w: 100, h: 100 }],
    ["tool1", { x: -200, y: 300, w: 100, h: 100 }],
    ["tool2", { x: 200, y: 200, w: 100, h: 100 }],
    ["model", { x: 0, y: -300, w: 100, h: 100 }],
  ]);
  const edges = [
    { source: "tool1", target: "agent", targetProperty: "tools" },
    { source: "tool2", target: "agent", targetProperty: "tools" },
    { source: "model", target: "agent", targetProperty: "model" },
  ];
  const original = structuredClone(rows);
  for (const direction of ["LR", "RL"] as const) {
    const result = resolveConfigPortRows(
      new Map([["agent", rows]]),
      boxes,
      new Map(),
      edges,
      direction,
    ).get("agent")!;
    assert.equal(result.length, 4);
    assert.deepEqual(result[0].anchor, { x: 50, y: 100, side: "bottom" });
    assert.deepEqual(result[1].anchor, { x: 50, y: 0, side: "top" });
    assert.equal(result[2], rows[2]);
    assert.equal(result[3], rows[3]);
  }
  boxes.set("tool1", { x: -200, y: -500, w: 100, h: 100 });
  const moved = resolveConfigPortRows(
    new Map([["agent", rows]]),
    boxes,
    new Map(),
    edges,
    "LR",
  ).get("agent")!;
  assert.equal(moved[0].anchor!.side, "top");
  assert.notEqual(moved[0].anchor!.x, moved[1].anchor!.x);
  assert.deepEqual(rows, original);
});

test("vertical flow uses left/right and disconnected ports keep their fallback side", () => {
  const boxes = new Map([
    ["agent", { x: 0, y: 0, w: 100, h: 100 }],
    ["tool", { x: 200, y: -200, w: 100, h: 100 }],
  ]);
  for (const direction of ["TB", "BT"] as const) {
    const result = resolveConfigPortRows(
      new Map([["agent", rows]]),
      boxes,
      new Map(),
      [{ source: "tool", target: "agent", targetProperty: "tools" }],
      direction,
    ).get("agent")!;
    assert.equal(result[0].anchor!.side, "right");
    assert.equal(result[1].anchor!.side, "left");
  }
  const detached = resolveConfigPortRows(
    new Map([["agent", rows]]),
    boxes,
    new Map(),
    [],
    "LR",
  ).get("agent")!;
  assert.equal(detached[0].anchor!.side, "top");
  assert.equal(detached[1].anchor!.side, "top");
});
