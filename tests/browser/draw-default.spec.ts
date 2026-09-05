import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const edgeHandles of [undefined, true, false]) {
  test(`Draw mode starts off with edgeHandles=${edgeHandles}`, async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.__flowTest.mount(false));
    await page.evaluate((edgeHandles) => window.__flowTest.configure({
      edgeHandles, isEdgeHandlesEnabled: undefined,
    }), edgeHandles);
    await page.evaluate(() => window.__flowTest.mount(true));
    const canvas = page.locator(".flow-sdk-canvas");
    await expect(canvas).toBeVisible();
    await expect(canvas).not.toHaveClass(/flow-sdk-draw/);
    await expect(page.locator(".flow-sdk-handle")).toHaveCount(edgeHandles === false ? 0 : 3);
    if (edgeHandles !== false) {
      await page.getByRole("button", { name: "Toggle toolbar collapse", exact: true }).click();
      const toggle = page.getByRole("button", { name: "Toggle draw mode", exact: true });
      await toggle.click();
      await expect(canvas).toHaveClass(/flow-sdk-draw/);
      await toggle.click();
      await expect(canvas).not.toHaveClass(/flow-sdk-draw/);
    }
  });
}

test("explicitly enabling Draw mode still works on mount", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.__flowTest.mount(false));
  await page.evaluate(() => window.__flowTest.configure({ edgeHandles: true, isEdgeHandlesEnabled: true }));
  await page.evaluate(() => window.__flowTest.mount(true));
  await expect(page.locator(".flow-sdk-canvas")).toHaveClass(/flow-sdk-draw/);
});