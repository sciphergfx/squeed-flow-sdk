import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  for (const direction of ["LR", "TB", "C"] as const) {
    test(`document selection centers its node and fits children at ${width}px, ${direction}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await ready(page, "custom=1");
      await page.evaluate(direction => window.__flowTest.configure({ direction }), direction);
      let previous = "";
      let stable = 0;
      await expect.poll(() => page.evaluate(() => {
        const engine = window.__flowTest.engine!;
        return JSON.stringify([engine.getNodeBox("beta"), engine.getNodeBox("gamma"), engine.zoom(), engine.pan()]);
      }).then(current => {
        stable = current === previous ? stable + 1 : 0;
        previous = current;
        return stable;
      })).toBeGreaterThanOrEqual(3);
      const result = await page.evaluate(async () => {
        const engine = window.__flowTest.engine!;
        const canvas = document.querySelector<HTMLElement>(".flow-sdk-canvas")!;
        const measure = () => {
          const bounds = canvas.getBoundingClientRect();
          const nodes = ["beta", "gamma"].map(id => document.querySelector(`[data-node-id="${id}"]`)!.getBoundingClientRect());
          return {
            selectedCenter: { x: nodes[0].x + nodes[0].width / 2 - bounds.x - bounds.width / 2, y: nodes[0].y + nodes[0].height / 2 - bounds.y - bounds.height / 2 },
            branchCenter: {
              x: (Math.min(...nodes.map(node => node.left)) + Math.max(...nodes.map(node => node.right))) / 2 - bounds.x - bounds.width / 2,
              y: (Math.min(...nodes.map(node => node.top)) + Math.max(...nodes.map(node => node.bottom))) / 2 - bounds.y - bounds.height / 2,
            },
            padding: nodes.map(node => Math.min(node.left - bounds.left, bounds.right - node.right, node.top - bounds.top, bounds.bottom - node.bottom)),
          };
        };
        engine.focusBranch("beta", 40, false);
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const original = measure();
        const frames: number[] = [];
        const unsubscribe = engine.onViewportChange(({ zoom }) => frames.push(zoom));
        engine.focusBranch("beta", 40, true, false, true);
        await new Promise<void>(resolve => {
          const start = performance.now();
          const frame = () => performance.now() - start > 700 ? resolve() : requestAnimationFrame(frame);
          requestAnimationFrame(frame);
        });
        unsubscribe();
        return { original, centered: measure(), zoomValues: new Set(frames).size };
      });
      expect(Math.abs(result.original.branchCenter.x)).toBeLessThan(1);
      expect(Math.abs(result.original.branchCenter.y)).toBeLessThan(1);
      expect(Math.abs(result.centered.selectedCenter.x)).toBeLessThan(1);
      expect(Math.abs(result.centered.selectedCenter.y)).toBeLessThan(1);
      expect(Math.min(...result.centered.padding)).toBeGreaterThanOrEqual(39);
      expect(result.zoomValues).toBeGreaterThan(3);
    });
  }
}

for (const width of [1440, 390]) {
  for (const instant of [false, true]) {
    test(`document preview close coordinates restore and layout at ${width}px, instant=${instant}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await ready(page, "custom=1");
      await page.evaluate((instant) => {
        window.__flowTest.configure({ direction: "C", compactPropertyLayout: true, disableAnimations: instant, animateViewport: !instant });
      }, instant);
      const snapshot = () => page.evaluate(() => {
        const engine = window.__flowTest.engine!;
        return { zoom: engine.zoom(), pan: engine.pan(), box: engine.getNodeBox("beta")! };
      });
      const settle = async () => {
        let previous = "";
        let stable = 0;
        await expect.poll(async () => {
          const current = JSON.stringify(await snapshot());
          stable = current === previous ? stable + 1 : 0;
          previous = current;
          return stable;
        }).toBeGreaterThanOrEqual(3);
      };
      await settle();
      const before = await snapshot();
      await page.evaluate((instant) => {
        const engine = window.__flowTest.engine!;
        engine.focusNode("beta", 40, !instant, true);
        window.__flowTest.replaceGraph({
          nodes: ["alpha", "beta", "gamma"].map(id => ({ data: { id, type: "text", label: id,
            viewProps: { width: id === "beta" ? 860 : 200, height: id === "beta" ? 355 : 100 } } })),
          edges: [{ data: { id: "alpha-beta", source: "alpha", target: "beta", label: "First" } },
            { data: { id: "beta-gamma", source: "beta", target: "gamma", label: "Second" } }],
        });
      }, instant);
      await expect.poll(() => page.evaluate(() => window.__flowTest.engine!.getNodeBox("beta")?.w)).toBe(860);
      await settle();
      const expanded = await snapshot();
      const frames = await page.evaluate(({ before, instant }) => new Promise<{ zoom: number; x: number; y: number; panX: number }[]>(resolve => {
        const engine = window.__flowTest.engine!;
        const frames: { zoom: number; x: number; y: number; panX: number }[] = [];
        const start = performance.now();
        engine.restoreView(!instant, { zoom: before.zoom, pan: before.pan }, true);
        window.__flowTest.replaceGraph({
          nodes: ["alpha", "beta", "gamma"].map(id => ({ data: { id, type: "text", label: id, viewProps: { width: 200, height: 100 } } })),
          edges: [{ data: { id: "alpha-beta", source: "alpha", target: "beta", label: "First" } },
            { data: { id: "beta-gamma", source: "beta", target: "gamma", label: "Second" } }],
        });
        const sample = () => {
          const box = engine.getNodeBox("beta")!;
          frames.push({ zoom: engine.zoom(), x: box.x, y: box.y, panX: engine.pan().x });
          if (performance.now() - start > 1000) resolve(frames);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }), { before, instant });
      const after = await snapshot();
      expect(after.zoom).toBeCloseTo(before.zoom, 8);
      expect(after.pan.x).toBeCloseTo(before.pan.x, 8);
      expect(after.pan.y).toBeCloseTo(before.pan.y, 8);
      expect(after.box.x).toBeCloseTo(before.box.x, 4);
      expect(after.box.y).toBeCloseTo(before.box.y, 4);
      const axis = Math.abs(before.box.x - expanded.box.x) > 1 ? "x" : "y";
      expect(Math.abs(before.box[axis] - expanded.box[axis])).toBeGreaterThan(1);
      if (!instant) {
        const progress = frames.map(frame => ({
          zoom: (frame.zoom - expanded.zoom) / (before.zoom - expanded.zoom),
          position: (frame[axis] - expanded.box[axis]) / (before.box[axis] - expanded.box[axis]),
        }));
        expect(progress.filter(frame => frame.zoom > 0.01 && frame.zoom < 0.99).length).toBeGreaterThan(3);
        expect(Math.max(...progress.map(frame => Math.abs(frame.zoom - frame.position)))).toBeLessThan(0.03);
      }
    });
  }
}

for (const width of [1440, 390]) {
  test(`initial graph is fitted before its first visible frame at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "custom=1");
    await page.evaluate(() => window.__flowTest.mount(false));
    await expect(page.locator(".flow-sdk-canvas")).toHaveCount(0);
    await page.evaluate(() => window.__flowTest.configure({ animateViewport: true }));
    const samples = await page.evaluate(() => new Promise<{ zoom: number; centered: boolean }[]>((resolve) => {
      const samples: { zoom: number; centered: boolean }[] = [];
      let frames = 0;
      window.__flowTest.events.length = 0;
      window.__flowTest.mount(true);
      const sample = () => {
        const canvas = document.querySelector(".flow-sdk-canvas");
        const nodes = [...document.querySelectorAll(".flow-sdk-node")].filter((node) => getComputedStyle(node).visibility !== "hidden");
        if (canvas && nodes.length === 3) {
          const boxes = [...nodes, ...canvas.querySelectorAll(":scope > svg > g")]
            .map((element) => element.getBoundingClientRect())
            .filter((box) => box.width > 0 && box.height > 0);
          const bounds = canvas.getBoundingClientRect();
          const centerX = (Math.min(...boxes.map((box) => box.left)) + Math.max(...boxes.map((box) => box.right))) / 2;
          const centerY = (Math.min(...boxes.map((box) => box.top)) + Math.max(...boxes.map((box) => box.bottom))) / 2;
          samples.push({
            zoom: window.__flowTest.engine!.zoom(),
            centered: Math.abs(centerX - (bounds.left + bounds.right) / 2) < 2 && Math.abs(centerY - (bounds.top + bounds.bottom) / 2) < 2,
          });
        }
        frames++;
        if (frames >= 120 || (samples.length > 2 && window.__flowTest.events.some((event) => event.name === "layout-complete"))) resolve(samples);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }));
    expect(samples.length).toBeGreaterThan(0);
    expect(samples[0].zoom).toBeGreaterThan(0.01);
    expect(samples[0].centered).toBe(true);
  });
}

test("direction refits inherit viewport animation and respect opt-out", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.waitForFunction(() => window.__flowTest?.engine);
  for (const animateViewport of [true, false, true]) {
    await page.evaluate((animate) => {
      window.__flowTest.configure({
        animateViewport: animate,
        direction: animate ? "TB" : "LR",
      });
    }, animateViewport);
    await expect.poll(() => page.evaluate(() => {
      const engine = window.__flowTest.engine!;
      const source = engine.getNodeBox("alpha")!;
      const target = engine.getNodeBox("beta")!;
      if (!source || !target) return null;
      return Math.abs(target.y - source.y) > Math.abs(target.x - source.x);
    })).toBe(animateViewport);
    const changes = await page.evaluate(async () => {
      const engine = window.__flowTest.engine!;
      engine.pan({ x: -500, y: -500 });
      const samples: number[] = [];
      const unsubscribe = engine.onViewportChange(({ pan }) => samples.push(pan.x));
      engine.centerAndFit(60);
      await new Promise<void>((resolve) => {
        const start = performance.now();
        const frame = () => {
          if (performance.now() - start >= 600) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      unsubscribe();
      return new Set(samples).size;
    });
    if (animateViewport) expect(changes).toBeGreaterThan(2);
    else expect(changes).toBe(1);
  }
});