import assert from "node:assert/strict";
import { test } from "node:test";
import { taxiPoints } from "../src/engine/geometry";
import { runDagreLayout } from "../src/engine/layout";

const nodes = [
  { id: "start", width: 806, height: 252 },
  { id: "service-a", width: 832, height: 364 },
  { id: "service-b", width: 806, height: 252 },
  { id: "service-c", width: 806, height: 252 },
  { id: "loop", width: 500, height: 150 },
  { id: "fan-out", width: 500, height: 150 },
  { id: "group", width: 60, height: 60 },
  { id: "worker-1", width: 806, height: 253, parent: "group" },
  { id: "worker-2", width: 806, height: 253, parent: "group" },
  { id: "end", width: 500, height: 150 },
];

const connections = [
  ["start", "service-a"],
  ["service-a", "service-b"],
  ["service-b", "service-c"],
  ["service-c", "service-a"],
  ["service-a", "service-b"],
  ["service-b", "service-a"],
  ["loop", "loop"],
  ["service-c", "loop"],
  ["loop", "fan-out"],
  ["service-a", "fan-out"],
  ["fan-out", "worker-1"],
  ["fan-out", "worker-2"],
  ["worker-1", "worker-2"],
  ["worker-2", "worker-1"],
  ["worker-2", "end"],
  ["end", "start"],
];

test("preserves legacy cycle ordering and parallel-edge rank spacing", () => {
  const positions = runDagreLayout(
    nodes,
    connections.map(([source, target], index) => ({
      id: `edge-${index}`,
      source,
      target,
    })),
    {
      rankDir: "LR",
      rankSep: 150,
      edgeSep: 250,
      nodeSep: 5,
      spacingFactor: 1.3,
    },
  );
  const start = positions.get("start")!;
  const first = positions.get("service-a")!;
  const second = positions.get("service-b")!;
  assert.equal(positions.size, 9);
  assert.ok(
    second.y < first.y,
    "the return cycle must not flip the service ranks",
  );
  assert.ok(Math.abs(first.x - start.x - 1262.3) < 0.01);
  assert.ok(Math.abs(second.x - first.x - 1262.3) < 0.01);
});

for (const rankDir of ["LR", "RL", "TB", "BT"] as const) {
  test(`${rankDir} preserves legacy node bounds and rank separation`, () => {
    const positions = runDagreLayout(
      nodes.slice(0, 2),
      [{ id: "connection", source: "start", target: "service-a" }],
      { rankDir, rankSep: 150, edgeSep: 250, nodeSep: 5, spacingFactor: 1.3 },
    );
    const source = positions.get("start")!;
    const target = positions.get("service-a")!;
    const horizontal = rankDir === "LR" || rankDir === "RL";
    const distance = horizontal ? target.x - source.x : target.y - source.y;
    const expected =
      (horizontal ? 1262.3 : 598) *
      (rankDir === "RL" || rankDir === "BT" ? -1 : 1);
    assert.ok(Math.abs(distance - expected) < 0.01);
  });
}

for (const direction of [
  "rightward",
  "leftward",
  "downward",
  "upward",
] as const) {
  test(`${direction} percentage turns keep return edges within graph bounds`, () => {
    const first = { x: 1000, y: 800, w: 100, h: 80 };
    const second = { x: 0, y: 0, w: 120, h: 100 };
    for (const [source, target] of [
      [first, second],
      [second, first],
    ]) {
      for (const turn of [0.3, 0.5, 0.7]) {
        const points = taxiPoints(source, target, direction, turn);
        for (const point of points) {
          assert.ok(point.x >= 0 && point.x <= 1000);
          assert.ok(point.y >= 0 && point.y <= 800);
        }
      }
    }
  });
}

const alignmentNodes = [
  { id: "root", width: 100, height: 100 },
  { id: "narrow", width: 120.5, height: 80.25 },
  { id: "wide", width: 310.75, height: 201.5 },
  { id: "end", width: 100, height: 100 },
];
const alignmentEdges = [
  { id: "root-narrow", source: "root", target: "narrow" },
  { id: "root-wide", source: "root", target: "wide" },
  { id: "narrow-end", source: "narrow", target: "end" },
  { id: "wide-end", source: "wide", target: "end" },
];

for (const rankDir of ["LR", "RL", "TB", "BT"] as const) {
  test(`${rankDir} compact layout closes gaps without shrinking or overlapping mixed node sizes`, () => {
    const options = { rankDir, rankSep: 220, edgeSep: 250, nodeSep: 5, spacingFactor: 1.3 };
    const regular = runDagreLayout(alignmentNodes, alignmentEdges, options);
    const compact = runDagreLayout(alignmentNodes, alignmentEdges, { ...options, compact: true });
    const area = (positions: typeof compact) => {
      const bounds = alignmentNodes.map(node => ({ ...positions.get(node.id)!, width: node.width, height: node.height }));
      return (Math.max(...bounds.map(node => node.x + node.width / 2)) - Math.min(...bounds.map(node => node.x - node.width / 2))) *
        (Math.max(...bounds.map(node => node.y + node.height / 2)) - Math.min(...bounds.map(node => node.y - node.height / 2)));
    };
    assert.ok(area(compact) < area(regular) * 0.8);
    for (const first of alignmentNodes) for (const second of alignmentNodes) {
      if (first.id === second.id) continue;
      const firstPoint = compact.get(first.id)!, secondPoint = compact.get(second.id)!;
      const separated = Math.abs(firstPoint.x - secondPoint.x) >= (first.width + second.width) / 2 || Math.abs(firstPoint.y - secondPoint.y) >= (first.height + second.height) / 2;
      assert.ok(separated, `${first.id} overlaps ${second.id}`);
    }
  });
}

for (const rankDir of ["LR", "RL", "TB", "BT"] as const) {
  for (const nodeAlignment of ["leading", "center", "trailing"] as const) {
    test(`${rankDir} ${nodeAlignment} aligns unequal nodes within their rank after spacing`, () => {
      const options = {
        rankDir,
        rankSep: 150,
        edgeSep: 250,
        nodeSep: 5,
        spacingFactor: 1.3,
      };
      const centered = runDagreLayout(alignmentNodes, alignmentEdges, options);
      const alignedOptions = { ...options, nodeAlignment };
      const aligned = runDagreLayout(
        alignmentNodes,
        alignmentEdges,
        alignedOptions,
      );
      const horizontal = rankDir === "LR" || rankDir === "RL";
      const axis = horizontal ? "x" : "y";
      const crossAxis = horizontal ? "y" : "x";
      const dimension = horizontal ? "width" : "height";
      const flowSign = rankDir === "RL" || rankDir === "BT" ? -1 : 1;
      const side =
        nodeAlignment === "center"
          ? 0
          : nodeAlignment === "leading"
            ? -flowSign
            : flowSign;
      const [narrow, wide] = alignmentNodes.slice(1, 3);
      const narrowPosition = aligned.get(narrow.id)!;
      const widePosition = aligned.get(wide.id)!;
      assert.ok(
        Math.abs(
          narrowPosition[axis] +
            (side * narrow[dimension]) / 2 -
            (widePosition[axis] + (side * wide[dimension]) / 2),
        ) < 0.00001,
      );
      assert.equal(
        narrowPosition[crossAxis],
        centered.get(narrow.id)![crossAxis],
      );
      assert.deepEqual(widePosition, centered.get(wide.id));
      assert.deepEqual(aligned.get("root"), centered.get("root"));
      assert.deepEqual(aligned.get("end"), centered.get("end"));
      if (nodeAlignment === "center") assert.deepEqual(aligned, centered);
    });
  }
}
