import assert from "node:assert/strict";
import { test } from "node:test";
import { surfaceBox } from "../src/engine/nodeSurface";
import {
  connectorEndpoints,
  perimeterGeometry,
  polylineGeometry,
  shapePort,
} from "../src/engine/geometry";

test("icon-label endpoints use the icon surface, not the caption or summary bounds", () => {
  assert.deepEqual(
    surfaceBox(
      { x: 500, y: 400, w: 360, h: 500 },
      { left: 80, top: 0, width: 200, height: 200, radius: 30 },
    ),
    { x: 500, y: 250, w: 200, h: 200 },
  );
});

test("diagonal connectors leave the diamond outline rather than its bounding rectangle", () => {
  const source = {
    x: 0,
    y: 0,
    w: 200,
    h: 200,
    outline: [
      { x: 0, y: -100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: -100, y: 0 },
    ],
  };
  const target = { x: 400, y: 400, w: 100, h: 100 };
  const geometry = polylineGeometry([source, target], source, target, {
    srcDist: 0,
    tgtDist: 0,
    arrowGap: 0,
    arrowSize: 0,
    radius: 0,
    arrowAt: "none",
  });
  assert.match(geometry!.d, /^M50 50 /);
});

test("SVG surface ports follow the transformed outline in every direction", () => {
  const box = surfaceBox(
    { x: 500, y: 400, w: 400, h: 300 },
    {
      left: 50,
      top: 20,
      width: 200,
      height: 200,
      radius: 0,
      outline: [
        { x: 150, y: 20 },
        { x: 250, y: 120 },
        { x: 150, y: 220 },
        { x: 50, y: 120 },
      ],
    },
  );
  const target = { x: 1000, y: 1000, w: 100, h: 100 };
  for (const [direction, point] of [
    ["rightward", { x: 550, y: 370 }],
    ["leftward", { x: 350, y: 370 }],
    ["downward", { x: 450, y: 470 }],
    ["upward", { x: 450, y: 270 }],
  ] as const) {
    assert.deepEqual(
      connectorEndpoints(box, target, direction, undefined, undefined, 0)
        .sourcePoint,
      point,
    );
  }
});

test("offset shape ports attach to sloped outlines instead of the rectangular host", () => {
  const diamond = {
    x: 100,
    y: 100,
    w: 200,
    h: 200,
    outline: [
      { x: 100, y: 0 },
      { x: 200, y: 100 },
      { x: 100, y: 200 },
      { x: 0, y: 100 },
    ],
  };
  assert.deepEqual(shapePort(diamond, "top", 0.25), {
    x: 50,
    y: 50,
    side: "top",
  });
  assert.deepEqual(shapePort(diamond, "bottom", 0.75), {
    x: 150,
    y: 150,
    side: "bottom",
  });
  assert.deepEqual(shapePort(diamond, "right", 0.25), {
    x: 150,
    y: 50,
    side: "right",
  });
  assert.deepEqual(shapePort(diamond, "left", 0.75), {
    x: 50,
    y: 150,
    side: "left",
  });
});

test("bottom-to-top connections preserve explicit port directions", () => {
  const options = {
    srcDist: 0,
    tgtDist: 0,
    arrowGap: 0,
    arrowSize: 20,
    radius: 20,
    arrowAt: "target" as const,
  };
  for (const type of [
    "straight",
    "bezier",
    "orthogonal",
    "rounded-orthogonal",
  ]) {
    const geometry = perimeterGeometry(
      { x: 100, y: 200, side: "bottom" },
      { x: 400, y: 600, side: "top" },
      options,
      type,
    );
    assert.match(geometry.d, /^M100 200 /);
    assert.match(geometry.arrow!, /^M400 600 /);
    assert.doesNotMatch(geometry.d, /NaN|Infinity/);
    if (type === "bezier") assert.match(geometry.d, /C100 /);
  }
});

test("wide bottom-to-top links do not overshoot a short vertical gap", () => {
  const geometry = perimeterGeometry(
    { x: 0, y: 0, side: "bottom" },
    { x: 1000, y: 100, side: "top" },
    {
      srcDist: 0,
      tgtDist: 0,
      arrowGap: 0,
      arrowSize: 20,
      radius: 0,
      arrowAt: "target",
    },
    "orthogonal",
  );
  const points = [...geometry.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
  assert.ok(points.length > 2);
  for (const point of points)
    assert.ok(Number(point[2]) >= 0 && Number(point[2]) <= 100, geometry.d);
});

test("opposing ports on side-by-side shapes never retrace their connector ends", () => {
  for (const [source, target] of [
    [
      { x: 0, y: 100, side: "bottom" },
      { x: 1000, y: -100, side: "top" },
    ],
    [
      { x: 0, y: -100, side: "top" },
      { x: 1000, y: 100, side: "bottom" },
    ],
    [
      { x: 100, y: 0, side: "right" },
      { x: -100, y: 1000, side: "left" },
    ],
    [
      { x: -100, y: 0, side: "left" },
      { x: 100, y: 1000, side: "right" },
    ],
  ] as const) {
    const geometry = perimeterGeometry(
      source,
      target,
      {
        srcDist: 0,
        tgtDist: 0,
        arrowGap: 0,
        arrowSize: 20,
        radius: 0,
        arrowAt: "target",
      },
      "orthogonal",
    );
    const points = [...geometry.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(
      (match) => ({ x: Number(match[1]), y: Number(match[2]) }),
    );
    assert.deepEqual(points[0], { x: source.x, y: source.y });
    assert.deepEqual(points.at(-1), { x: target.x, y: target.y });
    for (let index = 1; index < points.length - 1; index++) {
      const incoming = {
        x: points[index].x - points[index - 1].x,
        y: points[index].y - points[index - 1].y,
      };
      const outgoing = {
        x: points[index + 1].x - points[index].x,
        y: points[index + 1].y - points[index].y,
      };
      assert.ok(
        incoming.x * outgoing.x + incoming.y * outgoing.y >= 0,
        geometry.d,
      );
    }
  }
});
