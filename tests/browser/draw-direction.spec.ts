import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const direction of ["LR", "RL", "TB", "BT"] as const) {
  test(`${direction} places the draw handle on the outgoing side`, async ({ page }) => {
    await ready(page);
    await page.evaluate((direction) => {
      window.__flowTest.configure({ direction, edgeMode: "workflow" });
      window.__flowTest.replaceGraph({ nodes: [
        { data: { id: "source", type: "text", label: "Source" } },
        { data: { id: "target", type: "text", label: "Target" } },
      ], edges: [{ data: { id: "connection", source: "source", target: "target" } }] });
    }, direction);
    const source = page.locator('.flow-sdk-node[data-node-id="source"]');
    const target = page.locator('.flow-sdk-node[data-node-id="target"]');
    await source.locator("p[title]").hover();
    const handle = source.getByRole("button", { name: "Draw edge", exact: true });
    await expect(handle).toHaveCSS("opacity", "1");
    const offset = await handle.evaluate((element) => {
      const node = element.parentElement!.getBoundingClientRect();
      const button = element.getBoundingClientRect();
      return { x: button.x + button.width / 2 - (node.x + node.width / 2),
        y: button.y + button.height / 2 - (node.y + node.height / 2) };
    });
    if (direction === "LR" || direction === "RL") {
      expect(Math.abs(offset.y)).toBeLessThan(1);
      expect(offset.x * (direction === "LR" ? 1 : -1)).toBeGreaterThan(0);
    } else {
      expect(Math.abs(offset.x)).toBeLessThan(1);
      expect(offset.y * (direction === "TB" ? 1 : -1)).toBeGreaterThan(0);
    }
    await page.evaluate(() => window.__flowTest.configure({ isEdgeHandlesEnabled: true }));
    await page.mouse.move(5, 5);
    await expect(handle).toHaveCSS("opacity", "0");
    await expect(handle).toHaveCSS("pointer-events", "none");
    const sourceBox = await source.boundingBox();
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await expect(handle).toHaveCSS("pointer-events", "auto");
    await expect(handle).toHaveCSS("opacity", "1");
    await expect(target.getByRole("button", { name: "Draw edge", exact: true })).toHaveCSS("opacity", "0");
    const start = await handle.boundingBox();
    const end = await target.boundingBox();
    await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
    await page.mouse.down();
    await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 10 });
    await expect(page.locator('.flow-sdk-ghost')).toBeVisible();
    await page.mouse.up();
    await page.mouse.move(5, 5);
    await expect(handle).toHaveCSS("opacity", "0");
    await expect(target.getByRole("button", { name: "Draw edge", exact: true })).toHaveCSS("opacity", "0");
    expect(await page.evaluate(() => window.__flowTest.events.filter((event) => event.name === "create-edge"))).toEqual([
      { name: "create-edge", value: { source: "source", target: "target" } },
    ]);
  });
}