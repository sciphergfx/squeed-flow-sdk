import assert from "node:assert/strict";
import { test } from "node:test";
import { perimeterGeometry } from "../src/engine/geometry";
import type { PortAnchor } from "../src/engine/types";

const options = { srcDist: 18, tgtDist: 18, arrowGap: 36, arrowSize: 155, radius: 0, arrowAt: "target" as const };

for (const reverse of [false, true]) {
  for (const rotation of [false, true]) {
    test(`perpendicular port approach never doubles back (reverse=${reverse}, vertical=${rotation})`, () => {
      let source: PortAnchor = { x: 679.4, y: 4565.4, side: "right" };
      let target: PortAnchor = { x: 1731.2, y: 4460.9, side: "top" };
      if (reverse) [source, target] = [target, source];
      if (rotation) {
        source = { x: source.y, y: source.x, side: source.side === "right" ? "bottom" : "left" };
        target = { x: target.y, y: target.x, side: target.side === "right" ? "bottom" : "left" };
      }
      const geometry = perimeterGeometry(source, target, options, "orthogonal");
      const points = [...geometry.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
      assert.ok(points.length >= 4);
      for (let index = 1; index < points.length - 1; index++) {
        const before = points[index - 1], current = points[index], after = points[index + 1];
        const incoming = { x: current.x - before.x, y: current.y - before.y };
        const outgoing = { x: after.x - current.x, y: after.y - current.y };
        assert.ok(incoming.x * outgoing.x + incoming.y * outgoing.y >= 0, `reversed segment: ${geometry.d}`);
      }
    });
  }
}