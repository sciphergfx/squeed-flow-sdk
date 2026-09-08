import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

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