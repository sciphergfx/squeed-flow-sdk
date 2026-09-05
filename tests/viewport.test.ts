import assert from "node:assert/strict";
import { test } from "node:test";
import { Viewport } from "../src/engine/viewport";

test("zoomAt preserves the model point under the pointer", () => {
  const viewport = new Viewport({ pan: { x: 40, y: -20 }, zoom: 0.5 }, 0.01, 2);
  const pointer = { x: 170, y: 230 };
  const anchor = viewport.renderedToModel(pointer);
  viewport.zoomAt(1.25, pointer);
  assert.deepEqual(viewport.renderedToModel(pointer), anchor);
  viewport.zoomAt(10, pointer);
  assert.equal(viewport.zoom, 2);
  assert.deepEqual(viewport.renderedToModel(pointer), anchor);
});

test("fit and coordinate transforms preserve the viewport contract", () => {
  const viewport = new Viewport({ pan: { x: 0, y: 0 }, zoom: 1 }, 0.01, 2);
  viewport.size = { w: 800, h: 600 };
  viewport.fit({ x1: -100, y1: -50, x2: 900, y2: 450 }, 50);
  assert.equal(viewport.zoom, 0.7);
  assert.deepEqual(viewport.modelToRendered({ x: -100, y: -50 }), {
    x: 50,
    y: 125,
  });
  const point = { x: 300, y: 200 };
  assert.deepEqual(
    viewport.renderedToModel(viewport.modelToRendered(point)),
    point,
  );
});

test("viewport subscribers can unsubscribe and cannot mutate stored pan", () => {
  const viewport = new Viewport({ pan: { x: 0, y: 0 }, zoom: 1 }, 0.01, 2);
  let calls = 0;
  const unsubscribe = viewport.onChange((state) => {
    calls++;
    state.pan.x = 999;
  });
  viewport.set({ x: 20, y: 40 });
  assert.deepEqual(viewport.pan, { x: 20, y: 40 });
  unsubscribe();
  viewport.set({ x: 10, y: 10 });
  assert.equal(calls, 1);
});
