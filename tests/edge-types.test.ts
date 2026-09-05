import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bezierGeometry,
  connectorEndpoints,
  polylineGeometry,
  straightPortGeometry,
  taxiGeometry,
  type TaxiDir,
} from "../src/engine/geometry";

const source = { x: 0, y: 0, w: 200, h: 200 };
const options = {
  srcDist: 80,
  tgtDist: 80,
  arrowGap: 36,
  arrowSize: 155,
  radius: 0,
  arrowAt: "target" as const,
};
for (const direction of [
  "rightward",
  "leftward",
  "downward",
  "upward",
] as TaxiDir[]) {
  test(`${direction} connector types have finite paths and correct arrow endpoints`, () => {
    const vertical = direction === "downward" || direction === "upward";
    const sign = direction === "leftward" || direction === "upward" ? -1 : 1;
    const target = {
      ...source,
      x: vertical ? 400 : sign * 1000,
      y: vertical ? sign * 1000 : 400,
    };
    const points = connectorEndpoints(
      source,
      target,
      direction,
      undefined,
      undefined,
      80,
    );
    const curve = bezierGeometry(
      points.sourcePoint,
      points.targetPoint,
      direction,
      options,
    );
    assert.match(curve.d, / C/);
    assert.ok(
      curve.arrow!.startsWith(
        `M${points.targetPoint.x} ${points.targetPoint.y}`,
      ),
    );
    const reversed = bezierGeometry(
      points.sourcePoint,
      points.targetPoint,
      direction,
      { ...options, arrowAt: "source" },
    );
    assert.ok(
      reversed.arrow!.startsWith(
        `M${points.sourcePoint.x} ${points.sourcePoint.y}`,
      ),
    );
    const straight = polylineGeometry(
      [source, target],
      source,
      target,
      options,
    )!;
    assert.equal((straight.d.match(/L/g) ?? []).length, 1);
    const orthogonal = taxiGeometry(source, target, direction, 0.5, options)!;
    assert.ok(!orthogonal.d.includes("Q"));
    for (const geometry of [curve, reversed, straight, orthogonal]) {
      assert.ok(!/NaN|Infinity/.test(geometry.d));
      assert.ok(Number.isFinite(geometry.label.angle));
    }
  });
}

test("straight and curved property connectors preserve measured row anchors", () => {
  const target = { ...source, x: 1000, y: 400 };
  const points = connectorEndpoints(source, target, "downward", 30, 450, 18);
  assert.deepEqual(points, {
    sourcePoint: { x: 118, y: 30 },
    targetPoint: { x: 882, y: 450 },
  });
  for (const geometry of [
    straightPortGeometry(points.sourcePoint, points.targetPoint, options),
    bezierGeometry(
      points.sourcePoint,
      points.targetPoint,
      "rightward",
      options,
    ),
  ]) {
    assert.ok(geometry.d.startsWith("M118 30"));
    assert.ok(geometry.arrow!.startsWith("M882 450"));
  }
});
