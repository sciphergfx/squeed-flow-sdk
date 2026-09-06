import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`object views default to 53px and retain explicit radii at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page);
    await page.evaluate(() => window.__flowTest.replaceGraph({
      nodes: [
        { data: { id: "default", type: "objectView", label: "Default", description: { value: "Object" } } },
        { data: { id: "custom", type: "objectView", label: "Custom", description: { value: "Object" }, viewProps: { borderRadius: 25 } } },
        { data: { id: "square", type: "objectView", label: "Square", description: { value: "Object" }, viewProps: { borderRadius: 0 } } },
      ],
      edges: [],
    }));
    for (const [id, radius] of [["default", "53px"], ["custom", "25px"], ["square", "0px"]]) {
      const surface = page.locator(`.flow-sdk-node[data-node-id="${id}"] [data-flow-node-surface]`);
      await expect(surface).toHaveCSS("border-radius", radius);
      await expect(surface.locator(":scope > div").first()).toHaveCSS("border-radius", radius);
    }
    await page.evaluate(() => window.__flowTest.engine!.centerAndFit(70, false));
    await page.screenshot({ path: test.info().outputPath("object-radii.png") });
    await ready(page, "?graph=connections");
    const surface = page.locator('.flow-sdk-node[data-node-id="root.alpha"] [data-flow-node-surface]');
    await expect(surface).toHaveCSS("border-radius", "53px");
  });
}