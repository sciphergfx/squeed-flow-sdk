import { expect, test } from "@playwright/test";
import { ready, chooseToolbarOption } from "./helpers";

for (const width of [1440, 390]) {
  test(`consumer can compose controls without the default bar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json&consumerControls=1");
    await expect(page.getByRole("toolbar", { name: "Diagram controls" })).toHaveCount(0);
    const toolbar = page.getByRole("toolbar", { name: "Consumer controls" });
    await expect(toolbar).toBeVisible();
    await expect(page.getByTestId("consumer-node-count")).toHaveText("5");
    const draw = toolbar.getByRole("button", { name: "Consumer draw" });
    await draw.click();
    await expect(page.locator(".flow-sdk-canvas")).toHaveClass(/flow-sdk-draw/);
    await draw.click();
    await expect(page.locator(".flow-sdk-canvas")).not.toHaveClass(/flow-sdk-draw/);
    await chooseToolbarOption(toolbar.getByRole("combobox", { name: "Background variant" }), "Grid");
    await page.locator('.flow-sdk-node[data-node-id="root.beta"]').getByText("Beta", { exact: true }).click();
    const label = toolbar.getByRole("textbox", { name: "Node label", exact: true });
    await label.fill("Consumer edited");
    await label.press("Enter");
    await expect.poll(() => page.evaluate(() => window.__flowTest.document.beta.$label)).toBe("Consumer edited");
  });
}