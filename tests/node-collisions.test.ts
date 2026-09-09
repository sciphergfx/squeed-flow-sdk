import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectNodeCollisions,
  resolveNodeCollisions,
  type CollisionGeometry,
} from "../src/engine/nodeCollisions";

function geometry(): CollisionGeometry {
  return {
    nodes: [{ id: "alpha" }, { id: "beta" }],
    positions: new Map([
      ["alpha", { x: 0, y: 0 }],
      ["beta", { x: 25, y: 0 }],
    ]),
    sizes: new Map([
      ["alpha", { w: 100, h: 80 }],
      ["beta", { w: 100, h: 80 }],
    ]),
    padding: () => 20,
    minSize: () => undefined,
    fixedIds: new Set(),
  };
}

test("detects overlaps and separates nodes with margin without mutating inputs", () => {
  const input = geometry();
  const before = structuredClone(input.positions);
  assert.deepEqual(detectNodeCollisions(input), [
    { source: "alpha", target: "beta", overlap: { x: 90, y: 95 } },
  ]);
  const result = resolveNodeCollisions(input);
  assert.equal(result.resolved, true);
  assert.equal(result.iterations, 1);
  assert.deepEqual(result.movedNodeIds, ["alpha", "beta"]);
  assert.equal(
    result.positions.get("beta")!.x - result.positions.get("alpha")!.x,
    115,
  );
  assert.deepEqual(input.positions, before);
  assert.deepEqual(
    detectNodeCollisions({ ...input, positions: result.positions }),
    [],
  );
});

test("fixed nodes stay fixed and impossible collisions are reported", () => {
  const input = geometry();
  input.fixedIds = new Set(["alpha"]);
  const result = resolveNodeCollisions(input);
  assert.equal(result.resolved, true);
  assert.deepEqual(result.positions.get("alpha"), input.positions.get("alpha"));
  assert.deepEqual(result.movedNodeIds, ["beta"]);
  input.fixedIds = new Set(["alpha", "beta"]);
  const blocked = resolveNodeCollisions(input);
  assert.equal(blocked.resolved, false);
  assert.equal(blocked.collisions.length, 1);
  assert.deepEqual(blocked.movedNodeIds, []);
});

test("parent-child containment is ignored and groups move rigidly", () => {
  const input = geometry();
  input.nodes = [
    { id: "group" },
    { id: "alpha", parent: "group" },
    { id: "child", parent: "group" },
    { id: "beta" },
  ];
  input.positions.set("child", { x: -130, y: 0 });
  input.sizes.set("child", { w: 100, h: 80 });
  const detected = detectNodeCollisions(input);
  assert.deepEqual(
    detected.map(({ source, target }) => [source, target]),
    [["group", "beta"]],
  );
  const result = resolveNodeCollisions(input);
  assert.equal(result.resolved, true);
  assert.equal(
    result.positions.get("alpha")!.x - result.positions.get("child")!.x,
    130,
  );
  assert.equal(
    result.positions.get("alpha")!.y,
    result.positions.get("child")!.y,
  );
  input.fixedIds = new Set(["child"]);
  const pinnedGroup = resolveNodeCollisions(input);
  assert.deepEqual(
    pinnedGroup.positions.get("alpha"),
    input.positions.get("alpha"),
  );
  assert.deepEqual(
    pinnedGroup.positions.get("child"),
    input.positions.get("child"),
  );
  assert.equal(pinnedGroup.resolved, true);
});

test("handles containment, identical centers, and bounded dense layouts", () => {
  const input = geometry();
  input.positions.set("beta", { x: 0, y: 0 });
  input.sizes.set("alpha", { w: 300, h: 300 });
  assert.equal(resolveNodeCollisions(input).resolved, true);
  for (let index = 0; index < 25; index++) {
    const id = `node-${index}`;
    input.nodes.push({ id });
    input.positions.set(id, { x: 0, y: 0 });
    input.sizes.set(id, { w: 100, h: 80 });
  }
  const limited = resolveNodeCollisions(input, { maxIterations: 2 });
  assert.equal(limited.iterations, 2);
  assert.equal(limited.resolved, false);
  for (const position of limited.positions.values())
    assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y));
});

test("empty and separated layouts are no-ops; invalid options fail", () => {
  const input = geometry();
  input.positions.set("beta", { x: 115, y: 0 });
  assert.equal(resolveNodeCollisions(input).iterations, 0);
  assert.deepEqual(resolveNodeCollisions(input).movedNodeIds, []);
  assert.equal(resolveNodeCollisions({ ...input, nodes: [] }).resolved, true);
  for (const margin of [-1, NaN, Infinity])
    assert.throws(() => detectNodeCollisions(input, { margin }), RangeError);
  for (const maxIterations of [-1, 1.5, Infinity, 1001])
    assert.throws(
      () => resolveNodeCollisions(input, { maxIterations }),
      RangeError,
    );
});

test("nested groups are resolved inside-out with minimum container sizes", () => {
  const input = geometry();
  input.nodes = [
    { id: "outer" },
    { id: "inner", parent: "outer" },
    { id: "alpha", parent: "inner" },
    { id: "beta", parent: "inner" },
    { id: "other", parent: "outer" },
    { id: "outside" },
  ];
  input.positions.set("other", { x: 0, y: 0 });
  input.positions.set("outside", { x: 0, y: 0 });
  input.sizes.set("other", { w: 100, h: 80 });
  input.sizes.set("outside", { w: 100, h: 80 });
  input.minSize = () => ({ w: 500, h: 0 });
  const result = resolveNodeCollisions(input);
  assert.equal(result.resolved, true);
  assert.deepEqual(
    detectNodeCollisions({ ...input, positions: result.positions }),
    [],
  );
});

test("resolution is deterministic and idempotent after convergence", () => {
  const input = geometry();
  for (let index = 0; index < 12; index++) {
    const id = `node-${index}`;
    input.nodes.push({ id });
    input.positions.set(id, { x: index * 40, y: (index % 3) * 30 });
    input.sizes.set(id, { w: 60 + index * 2, h: 60 });
  }
  const result = resolveNodeCollisions(input, { maxIterations: 100 });
  assert.equal(result.resolved, true);
  assert.deepEqual(
    resolveNodeCollisions(input, { maxIterations: 100 }),
    result,
  );
  assert.deepEqual(
    resolveNodeCollisions({ ...input, positions: result.positions })
      .movedNodeIds,
    [],
  );
  const noIterations = resolveNodeCollisions(input, { maxIterations: 0 });
  assert.equal(noIterations.iterations, 0);
  assert.equal(noIterations.resolved, false);
  assert.deepEqual(noIterations.movedNodeIds, []);
});
