import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const direction of ["LR", "RL", "TB", "BT"] as const) {
  test(`${direction} Properties mode uses square heads and Nodes restores arrows`, async ({ page }) => {
    await ready(page, "?graph=connections");
    const original = await page.evaluate(() => structuredClone(window.__flowTest.document));
    const head = page.locator('.flow-sdk-edge[data-source-property="runtime"] > path').nth(1);
    for (const edgeType of ["rounded-orthogonal", "orthogonal", "straight", "bezier"] as const) {
      await page.evaluate(({ direction, edgeType }) => window.__flowTest.configure({ direction, edgeType, edgeMode: "properties" }), { direction, edgeType });
      await expect.poll(() => head.getAttribute("d").then(path => path?.match(/L/g)?.length)).toBe(4);
      const square = await head.evaluate(element => {
        const numbers = element.getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const points = Array.from({ length: 4 }, (_, index) => ({ x: numbers[2 + index * 2], y: numbers[3 + index * 2] }));
        return points.map((point, index) => Math.hypot(point.x - points[(index + 1) % 4].x, point.y - points[(index + 1) % 4].y));
      });
      expect(Math.max(...square) - Math.min(...square)).toBeLessThan(0.2);
      await page.evaluate(() => window.__flowTest.configure({ edgeMode: "nodes" }));
      await expect.poll(() => head.getAttribute("d").then(path => path?.match(/L/g)?.length)).toBe(2);
    }
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(original);
  });
}