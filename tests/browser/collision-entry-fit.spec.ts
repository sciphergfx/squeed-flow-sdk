import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  for (const animate of [false, true]) {
    test(`collision entry centers with 80px padding at ${width}px, animate=${animate}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, "custom=1");
      await page.evaluate(() => {
        window.__flowTest.events.length = 0;
        window.__flowTest.replaceGraph({
          nodes: Array.from({ length: 8 }, (_, index) => ({
            data: { id: `node-${index}`, type: "text", label: `Node ${index + 1}`, viewProps: { width: 260, height: 180 } },
          })),
          edges: [],
        });
      });
      await page.waitForFunction(() => window.__flowTest.events.some((event) => event.name === "layout-complete"));
      const previous = await page.evaluate((animate) => {
        const engine = window.__flowTest.engine!;
        engine.zoom(0.2);
        engine.pan({ x: 900, y: -700 });
        const previous = { zoom: engine.zoom(), pan: engine.pan() };
        engine.setNodeGridMode(true, { gaps: 15, animate });
        return previous;
      }, animate);
      await expect.poll(() => page.evaluate(() => {
        const canvas = document.querySelector(".flow-sdk-canvas")!.getBoundingClientRect();
        const boxes = [...document.querySelectorAll(".flow-sdk-node")].map((node) => node.getBoundingClientRect());
        const left = Math.min(...boxes.map((box) => box.left)) - canvas.left;
        const right = canvas.right - Math.max(...boxes.map((box) => box.right));
        const top = Math.min(...boxes.map((box) => box.top)) - canvas.top;
        const bottom = canvas.bottom - Math.max(...boxes.map((box) => box.bottom));
        return Math.max(Math.abs(left - right), Math.abs(top - bottom), Math.abs(Math.min(left, right, top, bottom) - 80));
      })).toBeLessThan(1);
      const centered = await page.evaluate(() => ({ zoom: window.__flowTest.engine!.zoom(), pan: window.__flowTest.engine!.pan() }));
      await page.evaluate(() => window.__flowTest.engine!.setNodeGridMode(true, { gaps: 30, animate: false }));
      expect(await page.evaluate(() => ({ zoom: window.__flowTest.engine!.zoom(), pan: window.__flowTest.engine!.pan() }))).toEqual(centered);
      await page.evaluate(() => window.__flowTest.engine!.setNodeGridMode(false, { animate: false }));
      const restored = await page.evaluate(() => ({ zoom: window.__flowTest.engine!.zoom(), pan: window.__flowTest.engine!.pan() }));
      expect(restored.zoom).toBeCloseTo(previous.zoom, 8);
      expect(restored.pan.x).toBeCloseTo(previous.pan.x, 8);
      expect(restored.pan.y).toBeCloseTo(previous.pan.y, 8);
    });
  }
}