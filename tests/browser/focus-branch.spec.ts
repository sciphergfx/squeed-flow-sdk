import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`branch focus includes connected descendants with root-prefixed IDs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page);
    await page.evaluate(() => {
      window.__flowTest.events.length = 0;
      window.__flowTest.replaceGraph({
        nodes: ["root-start", "child", "grandchild", "sibling"].map(id => ({
          data: { id, type: "text", label: id },
        })),
        edges: [
          { data: { id: "first", source: "root-start", target: "child" } },
          { data: { id: "second", source: "child", target: "grandchild" } },
          { data: { id: "third", source: "root-start", target: "sibling" } },
        ],
      });
    });
    await expect.poll(() => page.evaluate(() => window.__flowTest.events.some(event => event.name === "layout-complete"))).toBe(true);
    const target = await page.evaluate(() => {
      const engine = window.__flowTest.engine!;
      engine.focusBranch("root-start", 60, false);
      return { pan: engine.pan(), zoom: engine.zoom() };
    });
    for (const id of ["root-start", "child", "grandchild", "sibling"]) {
      const bounds = await page.locator(`.flow-sdk-node[data-node-id="${id}"]`).boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(59);
      expect(bounds!.y).toBeGreaterThanOrEqual(59);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 59);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(950 - 59);
    }
    await page.evaluate(() => {
      const engine = window.__flowTest.engine!;
      engine.pan({ x: -1000, y: -1000 });
      window.__flowTest.events.length = 0;
      engine.focusBranch("root-start", 60, true);
    });
    await expect.poll(() => page.evaluate(() => ({ pan: window.__flowTest.engine!.pan(), zoom: window.__flowTest.engine!.zoom() }))).toEqual(target);
    expect(await page.evaluate(() => window.__flowTest.events.filter(event => event.name === "viewport").length)).toBeGreaterThan(2);
    await page.screenshot({ path: test.info().outputPath("focused-branch.png") });
  });
}