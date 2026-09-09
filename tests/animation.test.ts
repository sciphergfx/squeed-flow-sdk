import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { animateTransition } from "../src/engine/animation";
import { Viewport } from "../src/engine/viewport";

function clock(context: TestContext, reduced = false) {
  let now = 100;
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  for (const [name, value] of Object.entries({
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextId, callback);
      return nextId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    matchMedia: () => ({ matches: reduced }),
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
    context.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  context.mock.method(performance, "now", () => now);
  context.mock.timers.enable({ apis: ["setTimeout"] });
  return {
    frames,
    advance(milliseconds: number) {
      now += milliseconds;
      for (const [id, callback] of [...frames]) {
        frames.delete(id);
        callback(now);
      }
    },
  };
}

test("layout and captured viewport use identical progress", (context) => {
  const time = clock(context);
  const viewport = new Viewport({ pan: { x: 0, y: 0 }, zoom: 1 }, 0.01, 2);
  const update = viewport.coordinate(() =>
    viewport.transition({ pan: { x: 100, y: 200 }, zoom: 0.5 }, true),
  );
  const positions: number[] = [];
  let completed = 0;
  animateTransition(
    true,
    (progress) => {
      positions.push(100 * progress);
      update!(progress);
      assert.equal(viewport.pan.x, positions.at(-1));
      assert.equal(viewport.pan.y, 200 * progress);
      assert.equal(viewport.zoom, 1 - 0.5 * progress);
    },
    () => completed++,
  );
  time.advance(75);
  time.advance(75);
  time.advance(150);
  assert.deepEqual(positions, [6.25, 50, 100]);
  assert.equal(completed, 1);
  assert.equal(time.frames.size, 0);
});

test("manual input invalidates captured viewport motion without cancelling layout", (context) => {
  const time = clock(context);
  const viewport = new Viewport({ pan: { x: 0, y: 0 }, zoom: 1 }, 0.01, 2);
  const update = viewport.coordinate(() =>
    viewport.transition({ pan: { x: 100, y: 200 }, zoom: 0.5 }, true),
  );
  let completed = false;
  animateTransition(true, update!, () => {
    completed = true;
  });
  time.advance(100);
  viewport.set({ x: 12, y: 34 }, 0.42);
  time.advance(200);
  assert.deepEqual(viewport.state, { pan: { x: 12, y: 34 }, zoom: 0.42 });
  assert.equal(completed, true);
});

test("animation cancellation and background fallback complete at most once", (context) => {
  const time = clock(context);
  const values: number[] = [];
  let completed = 0;
  const cancel = animateTransition(
    true,
    (progress) => values.push(progress),
    () => completed++,
  );
  time.advance(150);
  cancel();
  context.mock.timers.tick(400);
  assert.deepEqual(values, [0.5]);
  assert.equal(completed, 0);
  animateTransition(
    true,
    (progress) => values.push(progress),
    () => completed++,
  );
  context.mock.timers.tick(400);
  time.advance(500);
  assert.deepEqual(values, [0.5, 1]);
  assert.equal(completed, 1);
});

test("reduced motion applies final geometry without scheduling frames", (context) => {
  const time = clock(context, true);
  const values: number[] = [];
  animateTransition(true, (progress) => values.push(progress));
  assert.deepEqual(values, [1]);
  assert.equal(time.frames.size, 0);
});

test("kill switch finishes active transitions and overrides explicit animation", (context) => {
  const time = clock(context);
  const viewport = new Viewport({ pan: { x: 0, y: 0 }, zoom: 1 }, 0.01, 2);
  const target = { pan: { x: 100, y: 200 }, zoom: 0.5 };
  viewport.transition(target, true);
  time.advance(50);
  assert.notDeepEqual(viewport.state, target);
  viewport.setAnimationsDisabled(true);
  assert.deepEqual(viewport.state, target);
  assert.equal(time.frames.size, 0);
  viewport.transition({ pan: { x: 10, y: 20 }, zoom: 0.2 }, true);
  assert.deepEqual(viewport.state, { pan: { x: 10, y: 20 }, zoom: 0.2 });
  assert.equal(time.frames.size, 0);
  viewport.setAnimationsDisabled(false);
  viewport.transition(target, true);
  assert.equal(time.frames.size, 1);
  time.advance(300);
  assert.deepEqual(viewport.state, target);
});
