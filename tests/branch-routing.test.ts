import assert from "node:assert/strict";
import { test } from "node:test";
import { branchRoutes } from "../src/engine/branchRouting";
import { taxiGeometry, taxiPoints, type TaxiDir } from "../src/engine/geometry";
import type { Box } from "../src/engine/types";

for (const direction of [
  "rightward",
  "leftward",
  "downward",
  "upward",
] as TaxiDir[]) {
  test(`fan-out bends occupy distinct lanes in ${direction}`, () => {
    const vertical = direction === "downward" || direction === "upward";
    const sign = direction === "leftward" || direction === "upward" ? -1 : 1;
    const boxes = new Map<string, Box>([
      ["source", { x: 0, y: 0, w: 200, h: 200 }],
      ...[0, 1, 2].map((index): [string, Box] => [
        `target-${index}`,
        {
          x: vertical ? 500 + index * 300 : sign * (1200 + index * 400),
          y: vertical ? sign * (1200 + index * 400) : 500 + index * 300,
          w: 200,
          h: 200,
        },
      ]),
    ]);
    const edges = [0, 1, 2].map((index) => ({
      id: `edge-${index}`,
      source: "source",
      target: `target-${index}`,
    }));
    const routes = branchRoutes(edges, (id) => boxes.get(id), direction);
    assert.equal(routes.size, 3);
    const lanes = edges.map((edge) => {
      const route = routes.get(edge.id)!;
      assert.equal(route.labelAtTarget, true);
      const points = taxiPoints(
        boxes.get(edge.source)!,
        boxes.get(edge.target)!,
        direction,
        route.turn,
      );
      return vertical ? points[1].y : points[1].x;
    });
    assert.equal(new Set(lanes).size, 3);
    const labels = edges.map((edge) => {
      const geometry = taxiGeometry(
        boxes.get(edge.source)!,
        boxes.get(edge.target)!,
        direction,
        routes.get(edge.id)!.turn,
        {
          srcDist: 80,
          tgtDist: 80,
          arrowGap: 36,
          arrowSize: 155,
          radius: 40,
          arrowAt: "target",
          labelTargetLength: 230,
          labelFraction: routes.get(edge.id)!.labelFraction,
        },
      )!;
      assert.ok(!/NaN|Infinity/.test(geometry.d));
      const cross = vertical ? geometry.label.x : geometry.label.y;
      const targetCross = vertical
        ? boxes.get(edge.target)!.x
        : boxes.get(edge.target)!.y;
      assert.ok(cross > 0 && cross <= targetCross);
      assert.equal(
        Math.abs(geometry.label.angle),
        cross === targetCross ? (vertical ? 90 : 0) : vertical ? 0 : 90,
      );
      return JSON.stringify(geometry.label);
    });
    assert.equal(new Set(labels).size, 3);
    assert.deepEqual(
      branchRoutes([...edges].reverse(), (id) => boxes.get(id), direction),
      routes,
    );
  });
}

test("loops, property links and same-pair parallel edges retain their routing", () => {
  const boxes = new Map<string, Box>([
    ["source", { x: 0, y: 0, w: 200, h: 200 }],
    ["target", { x: 1200, y: 500, w: 200, h: 200 }],
  ]);
  const edges = [
    { id: "first", source: "source", target: "target" },
    { id: "second", source: "source", target: "target" },
    { id: "loop", source: "source", target: "source" },
    {
      id: "property",
      source: "target",
      target: "source",
      sourceProperty: "id",
    },
  ];
  assert.equal(branchRoutes(edges, (id) => boxes.get(id), "rightward").size, 0);
});
