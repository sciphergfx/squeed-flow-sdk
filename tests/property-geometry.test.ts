import assert from "node:assert/strict";
import { test } from "node:test";
import { propertyGeometry } from "../src/engine/geometry";

const options = {
  srcDist: 18,
  tgtDist: 18,
  arrowGap: 36,
  arrowSize: 155,
  radius: 500,
  arrowAt: "target" as const,
};
const source = { x: 200, y: 300, w: 200, h: 240 };
const target = { x: 1000, y: 500, w: 300, h: 300 };

test("property arrows attach to row centers instead of node centers", () => {
  const geometry = propertyGeometry(
    source,
    target,
    "rightward",
    340,
    560,
    0.5,
    options,
  );
  assert.ok(geometry.d.startsWith("M318 340"));
  assert.ok(geometry.arrow?.startsWith("M832 560"));
  assert.ok(!/NaN|Infinity/.test(geometry.d));
});

test("right-to-left ports reverse sides without reversing property identities", () => {
  const geometry = propertyGeometry(
    target,
    source,
    "leftward",
    540,
    360,
    0.5,
    options,
  );
  assert.ok(geometry.d.startsWith("M832 540"));
  assert.ok(geometry.arrow?.startsWith("M318 360"));
});

test("backward and same-node property links route outside the node boxes", () => {
  for (const destination of [source, target]) {
    const geometry = propertyGeometry(
      target,
      destination,
      "rightward",
      530,
      550,
      0.5,
      options,
    );
    assert.ok(geometry.d.startsWith("M1168 530"));
    assert.ok(
      geometry.arrow?.startsWith(
        `M${destination.x - destination.w / 2 - 18} 550`,
      ),
    );
    assert.ok(!/NaN|Infinity/.test(geometry.d));
  }
});

test("a missing property endpoint falls back to that node's midpoint", () => {
  const geometry = propertyGeometry(
    source,
    target,
    "downward",
    undefined,
    560,
    0.5,
    options,
  );
  assert.ok(geometry.d.startsWith("M318 300"));
  assert.ok(geometry.arrow?.startsWith("M832 560"));
});
