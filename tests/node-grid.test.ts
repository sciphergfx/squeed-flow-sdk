import assert from "node:assert/strict";
import { test } from "node:test";
import { computeContainers } from "../src/engine/layout";
import {
  adjustGridDivider,
  arrangeNodesInGrid,
  detectNodeCollisions,
  type CollisionGeometry,
} from "../src/engine/nodeCollisions";

function geometry(count = 8): CollisionGeometry {
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `node-${index}`,
  }));
  return {
    nodes,
    positions: new Map(
      nodes.map((node, index) => [node.id, { x: index * 135, y: index * 73 }]),
    ),
    sizes: new Map(
      nodes.map((node, index) => [
        node.id,
        { w: 100 + index * 5, h: 60 + index * 7 },
      ]),
    ),
    padding: () => 20,
    minSize: () => undefined,
    fixedIds: new Set(),
  };
}

test("section adjustments retain proportional widths and row heights across viewport sizes", () => {
  const options = {
    fill: true,
    columns: 2,
    gaps: 0,
    adjustment: {
      enabled: true,
      sections: {
        canvas: {
          rows: [1, 3],
          columns: [
            [1, 3],
            [2, 2],
          ],
        },
      },
    },
  };
  for (const viewportSize of [
    { w: 1200, h: 800 },
    { w: 360, h: 640 },
  ]) {
    const result = arrangeNodesInGrid(
      { ...geometry(4), viewportSize },
      options,
    );
    assert.equal(result.sizes!.get("node-0")!.w, viewportSize.w / 4);
    assert.equal(result.sizes!.get("node-0")!.h, viewportSize.h / 4);
    assert.equal(result.sizes!.get("node-1")!.w, (viewportSize.w * 3) / 4);
    assert.equal(result.sizes!.get("node-2")!.w, viewportSize.w / 2);
    assert.deepEqual(result.collisions, []);
    const divider = result.dividers!.find(
      (divider) => divider.axis === "x" && divider.row === 0,
    )!;
    const adjusted = adjustGridDivider(options, divider, viewportSize.w / 4);
    assert.deepEqual(adjusted.adjustment!.sections!.canvas.columns![0], [2, 2]);
    assert.deepEqual(options.adjustment.sections.canvas.columns[0], [1, 3]);
  }
  assert.throws(
    () =>
      arrangeNodesInGrid(
        { ...geometry(4), viewportSize: { w: 800, h: 600 } },
        { adjustment: { sections: { canvas: { rows: [0] } } } },
      ),
    /proportions/,
  );
});

test("eight variable-sized nodes form a three-column grid without mutating input", () => {
  const input = geometry();
  const before = structuredClone(input.positions);
  const result = arrangeNodesInGrid(input, { margin: 24 });
  const positions = [...result.positions.values()];
  assert.equal(new Set(positions.map((position) => position.x)).size, 3);
  assert.equal(new Set(positions.map((position) => position.y)).size, 3);
  positions.forEach((position, index) => {
    assert.equal(position.x, positions[index % 3].x);
    assert.equal(position.y, positions[Math.floor(index / 3) * 3].y);
  });
  assert.equal(positions[1].x - positions[0].x, 159);
  assert.equal(positions[3].y - positions[0].y, 133);
  assert.deepEqual(input.positions, before);
  assert.deepEqual(result.collisions, []);
  assert.deepEqual(result.skippedNodeIds, []);
  const repeated = arrangeNodesInGrid(
    { ...input, positions: result.positions },
    { margin: 24 },
  );
  assert.deepEqual(repeated.positions, result.positions);
  const reordered = {
    ...input,
    positions: result.positions,
    nodes: [...input.nodes],
  };
  [reordered.nodes[0], reordered.nodes[7]] = [
    reordered.nodes[7],
    reordered.nodes[0],
  ];
  const swapped = arrangeNodesInGrid(reordered, { margin: 24 });
  assert.deepEqual(
    swapped.positions.get("node-0"),
    result.positions.get("node-7"),
  );
  assert.deepEqual(
    swapped.positions.get("node-7"),
    result.positions.get("node-0"),
  );
});

test("explicit columns support single-column layouts and zero margin", () => {
  const input = geometry();
  const result = arrangeNodesInGrid(input, { columns: 1, margin: 0 });
  assert.equal(
    new Set([...result.positions.values()].map((position) => position.x)).size,
    1,
  );
  assert.equal(
    new Set([...result.positions.values()].map((position) => position.y)).size,
    8,
  );
  assert.deepEqual(
    detectNodeCollisions(
      { ...input, positions: result.positions },
      { margin: 0 },
    ),
    [],
  );
});

test("groups are arranged inside-out, preserving containment and avoiding sibling overlaps", () => {
  const input = geometry(4);
  input.nodes = [
    { id: "outer" },
    { id: "left", parent: "outer" },
    { id: "right", parent: "outer" },
    { id: "node-0", parent: "left" },
    { id: "node-1", parent: "left" },
    { id: "node-2", parent: "right" },
    { id: "node-3", parent: "right" },
  ];
  input.minSize = () => ({ w: 400, h: 0 });
  const result = arrangeNodesInGrid(input, { columns: 2 });
  assert.deepEqual(result.collisions, []);
  assert.deepEqual(result.skippedNodeIds, []);
  const containers = computeContainers(
    input.nodes,
    result.positions,
    input.sizes,
    input.padding,
    input.minSize,
  );
  assert.equal(
    containers.get("left")!.y1 + containers.get("left")!.y2,
    containers.get("right")!.y1 + containers.get("right")!.y2,
  );
  assert.equal(
    result.positions.get("node-0")!.y,
    result.positions.get("node-1")!.y,
  );
  assert.equal(
    result.positions.get("node-2")!.y,
    result.positions.get("node-3")!.y,
  );
});

test("disconnected expanded parents remain within their Fill cells and respect grid gaps", () => {
  const input = geometry(2);
  input.nodes = [
    { id: "parent" },
    { id: "node-0", parent: "parent" },
    { id: "node-1" },
  ];
  input.padding = () => 80;
  input.minSize = () => ({ w: 400, h: 0 });
  for (const viewportSize of [
    { w: 390, h: 640 },
    { w: 1440, h: 900 },
  ]) {
    const result = arrangeNodesInGrid(
      { ...input, viewportSize },
      { fill: true, columns: 2, gaps: 24 },
    );
    const containers = computeContainers(
      input.nodes,
      result.positions,
      result.sizes!,
      input.padding,
      input.minSize,
      result.sizes,
    );
    const parent = containers.get("parent")!;
    const sibling = result.positions.get("node-1")!;
    const siblingSize = result.sizes!.get("node-1")!;
    assert.equal(parent.x1, 0);
    assert.equal(parent.y1, 0);
    assert.equal(parent.y2, viewportSize.h);
    assert.equal(sibling.x - siblingSize.w / 2 - parent.x2, 24);
    assert.deepEqual(result.collisions, []);
    assert.deepEqual(
      detectNodeCollisions(
        {
          ...input,
          positions: result.positions,
          sizes: result.sizes!,
          fixedSizes: result.sizes,
        },
        { margin: 24 },
      ),
      [],
    );
  }
});

test("pinned sibling groups are skipped, not silently unpinned", () => {
  const input = geometry();
  input.fixedIds = new Set(["node-0"]);
  const result = arrangeNodesInGrid(input);
  assert.deepEqual(result.positions, input.positions);
  assert.deepEqual(result.movedNodeIds, []);
  assert.deepEqual(
    result.skippedNodeIds,
    input.nodes.map((node) => node.id),
  );
});

test("empty and single-node layouts are no-ops and invalid options are rejected", () => {
  for (const count of [0, 1])
    assert.deepEqual(arrangeNodesInGrid(geometry(count)).movedNodeIds, []);
  for (const columns of [0, -1, 1.5, NaN, Infinity])
    assert.throws(
      () => arrangeNodesInGrid(geometry(), { columns }),
      RangeError,
    );
  for (const margin of [-1, NaN, Infinity])
    assert.throws(() => arrangeNodesInGrid(geometry(), { margin }), RangeError);
  for (const gaps of [-1, NaN, Infinity, { x: 10, y: -2 }])
    assert.throws(() => arrangeNodesInGrid(geometry(), { gaps }), RangeError);
  for (const padding of [-1, NaN, Infinity])
    assert.throws(
      () => arrangeNodesInGrid(geometry(), { padding }),
      RangeError,
    );
});

test("grid uses independent horizontal and vertical gaps", () => {
  const result = arrangeNodesInGrid(geometry(), {
    columns: 3,
    gaps: { x: 50, y: 30 },
  });
  const positions = [...result.positions.values()];
  assert.equal(positions[1].x - positions[0].x, 185);
  assert.equal(positions[3].y - positions[0].y, 139);
  assert.deepEqual(result.collisions, []);
});

test("fill adapts columns and spreads nodes across the available canvas", () => {
  const input = geometry();
  input.nodes.forEach((node) => input.sizes.set(node.id, { w: 100, h: 100 }));
  for (const viewportSize of [
    { w: 1240, h: 640 },
    { w: 440, h: 940 },
  ]) {
    const result = arrangeNodesInGrid(
      { ...input, viewportSize },
      { fill: true, gaps: 20, padding: 20 },
    );
    const bounds = result.bounds!;
    assert.equal(bounds.x2 - bounds.x1, viewportSize.w - 40);
    assert.equal(bounds.y2 - bounds.y1, viewportSize.h - 40);
    const positions = [...result.positions.values()];
    assert.equal(
      new Set(positions.map((position) => position.x)).size,
      viewportSize.w > viewportSize.h ? 4 : 2,
    );
    assert.deepEqual(result.collisions, []);
    const boxes = [...result.positions].map(([id, position]) => ({
      ...position,
      ...result.sizes!.get(id)!,
    }));
    assert.equal(Math.min(...boxes.map((box) => box.x - box.w / 2)), bounds.x1);
    assert.equal(Math.max(...boxes.map((box) => box.x + box.w / 2)), bounds.x2);
    assert.equal(Math.min(...boxes.map((box) => box.y - box.h / 2)), bounds.y1);
    assert.equal(Math.max(...boxes.map((box) => box.y + box.h / 2)), bounds.y2);
  }
});

test("fill tiles cover the entire canvas including an incomplete last row", () => {
  for (const count of [1, 2, 5, 8]) {
    const result = arrangeNodesInGrid(
      { ...geometry(count), viewportSize: { w: 1200, h: 750 } },
      { fill: true, columns: 3, gaps: 0 },
    );
    const area = [...result.sizes!.values()].reduce(
      (sum, size) => sum + size.w * size.h,
      0,
    );
    assert.ok(Math.abs(area - 1200 * 750) < 0.001);
    assert.deepEqual(result.collisions, []);
    assert.deepEqual(result.bounds, { x1: 0, y1: 0, x2: 1200, y2: 750 });
  }
});
