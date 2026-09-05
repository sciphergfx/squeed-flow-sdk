import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  for (const toolbar of [false, true]) {
    test(`expansion centers revealed children at ${width}px via ${toolbar ? "toolbar" : "node"}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      await ready(page, "?graph=json");
      await page.evaluate(() => window.__flowTest.replaceDocument({
        branch: { $label: "Branch", $collapsed: true, first: { value: 1 }, second: { value: 2 } },
        sibling: { $label: "Unrelated" },
      }));
      const branch = page.locator('.flow-sdk-node[data-node-id="root.branch"]');
      await expect(branch.getByRole("button", { name: "Expand", exact: true })).toBeVisible();
      await page.evaluate(() => {
        const engine = window.__flowTest.engine!;
        const box = engine.getNodeBox("root.branch")!;
        const canvas = document.querySelector(".flow-sdk-canvas")!.getBoundingClientRect();
        engine.zoom(0.2);
        engine.pan({ x: canvas.width / 2 - box.x * 0.2, y: 180 - box.y * 0.2 });
      });
      if (toolbar) {
        await branch.getByText("Branch", { exact: true }).click();
        await page.getByRole("button", { name: "Expand node", exact: true }).click();
      } else await branch.getByRole("button", { name: "Expand", exact: true }).click();
      await expect.poll(() => page.evaluate(() => {
        const engine = window.__flowTest.engine!;
        const boxes = ["root.branch.first", "root.branch.second"].map(id => engine.getNodeBox(id));
        if (boxes.some(box => !box)) return Infinity;
        const left = Math.min(...boxes.map(box => box!.x - box!.w / 2));
        const right = Math.max(...boxes.map(box => box!.x + box!.w / 2));
        const top = Math.min(...boxes.map(box => box!.y - box!.h / 2));
        const bottom = Math.max(...boxes.map(box => box!.y + box!.h / 2));
        const center = engine.modelToClient({ x: (left + right) / 2, y: (top + bottom) / 2 });
        const canvas = document.querySelector(".flow-sdk-canvas")!.getBoundingClientRect();
        return Math.hypot(center.x - canvas.x - canvas.width / 2, center.y - canvas.y - canvas.height / 2);
      })).toBeLessThan(1);
      expect(await page.evaluate(() => window.__flowTest.engine!.zoom())).toBe(0.2);
    });
  }
}