import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`viewport actions preserve document data at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json");
    const original = await page.evaluate(() => window.__flowTest.document);
    const edgeCount = await page.locator(".flow-sdk-edge").count();
    await page.evaluate(() => window.__flowTest.engine!.setEdgesVisible(false));
    await expect(page.locator(".flow-sdk-edge")).toHaveCount(0);
    await expect(page.locator(".flow-sdk-edge-label")).toHaveCount(0);
    await page.evaluate(() => window.__flowTest.engine!.setEdgesVisible(true));
    await expect(page.locator(".flow-sdk-edge")).toHaveCount(edgeCount);
    await page.evaluate(() => window.__flowTest.engine!.focusNode("root.alpha", 60));
    const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    const nodeBounds = await node.boundingBox();
    expect(nodeBounds!.x).toBeGreaterThanOrEqual(59);
    expect(nodeBounds!.x + nodeBounds!.width).toBeLessThanOrEqual(width - 59);
    await page.evaluate(() => window.__flowTest.engine!.focusBranch("root.alpha", 40));
    for (const id of ["root.alpha", "root.alpha.child"]) {
      const bounds = await page.locator(`.flow-sdk-node[data-node-id="${id}"]`).boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(39);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 39);
    }
    const before = await page.evaluate(() => ({ pan: window.__flowTest.engine!.pan(), zoom: window.__flowTest.engine!.zoom() }));
    await page.evaluate(() => window.__flowTest.engine!.isolateBranch("root.alpha", 30));
    await expect(page.locator('.flow-sdk-node[data-node-id="root.beta"]')).toBeHidden();
    await expect(node).toBeVisible();
    await expect(page.locator('.flow-sdk-node[data-node-id="root.alpha.child"]')).toBeVisible();
    await page.evaluate(() => window.__flowTest.engine!.restoreView());
    await expect(page.locator('.flow-sdk-node[data-node-id="root.beta"]')).toBeVisible();
    expect(await page.evaluate(() => ({ pan: window.__flowTest.engine!.pan(), zoom: window.__flowTest.engine!.zoom() }))).toEqual(before);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(original);
  });
}