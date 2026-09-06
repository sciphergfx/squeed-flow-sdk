import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`only connected ports remain outside Draw mode at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json");
    await page.evaluate(() => {
      window.__flowTest.configure({ edgeMode: "properties", isEdgeHandlesEnabled: false });
      window.__flowTest.replaceDocument({
        alpha: { $label: "Source", $ports: [
          { id: "connected", role: "source", side: "right", position: 0.3 },
          { id: "spare", role: "source", side: "top", position: 0.7 },
        ], $connections: [{ target: "root.beta", sourceProperty: "connected", targetProperty: "input" }] },
        beta: { $label: "Target", $ports: [
          { id: "input", role: "target", side: "left", position: 0.3 },
          { id: "spare", role: "target", side: "bottom", position: 0.7 },
        ] },
      });
    });
    const ports = page.locator(".flow-sdk-property-port");
    await expect(ports).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Connect connected", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Input input", exact: true })).toBeVisible();
    await page.evaluate(() => window.__flowTest.configure({ isEdgeHandlesEnabled: true }));
    await expect(ports).toHaveCount(4);
    await page.evaluate(() => window.__flowTest.configure({ isEdgeHandlesEnabled: false }));
    await expect(ports).toHaveCount(2);
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(ports).toHaveCount(0);
  });
}