import { expect, test } from "@playwright/test";
import { ready, dragBetween } from "./helpers";

for (const width of [1440, 390]) {
  test(`custom named ports preserve direction and connection IDs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?custom=ports");
    await page.evaluate(() => window.__flowTest.configure({ isEdgeHandlesEnabled: true }));
    const source = page.locator('.flow-sdk-node[data-node-id="alpha"]');
    const target = page.locator('.flow-sdk-node[data-node-id="beta"]');
    await expect(source.locator('[data-port-role="source"]')).toHaveCount(2);
    await expect(source.locator('[data-port-role="target"]')).toHaveCount(0);
    await expect(target.locator('[data-port-role="target"]')).toHaveCount(1);
    await expect(target.locator('[data-port-role="source"]')).toHaveCount(0);
    const output = await source.getByRole("button", { name: "Connect true", exact: true }).boundingBox();
    const input = await target.getByRole("button", { name: "Input input", exact: true }).boundingBox();
    await dragBetween(page, { x: output!.x + output!.width / 2, y: output!.y + output!.height / 2 }, { x: input!.x + input!.width / 2, y: input!.y + input!.height / 2 });
    await expect.poll(() => page.evaluate(() => window.__flowTest.events.filter(event => event.name === "create-edge").map(event => event.value))).toContainEqual({ source: "alpha", target: "beta", sourceProperty: "true", targetProperty: "input" });
    await expect(page.locator('.flow-sdk-edge[data-source-property="true"][data-target-property="input"]')).toHaveCount(1);
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(page.locator(".flow-sdk-property-port")).toHaveCount(0);
  });
}