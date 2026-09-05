import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`parent containers do not paint a collapsed DOM border at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    await page.evaluate(() => window.__flowTest.replaceGraph({
      nodes: [
        { data: { id: "services", type: "parentContainer", label: "Commerce Services", config: { icon: "PiCube" }, viewProps: { minWidth: 700, borderStyle: "dashed", borderColor: "green.500", bgColor: "transparent" } } },
        { data: { id: "orders", type: "text", label: "Orders", parent: "services" } },
        { data: { id: "payments", type: "text", label: "Payments", parent: "services" } },
      ],
      edges: [{ data: { id: "orders-payments", source: "orders", target: "payments" } }],
    }));
    const container = page.locator('.flow-sdk-container[data-node-id="services"]');
    const title = page.locator('.flow-sdk-container-label[data-node-id="services"] text');
    await expect(title).toHaveText("Commerce Services");
    await page.locator('.flow-sdk-node[data-node-id="payments"]').screenshot();
    await page.evaluate(() => window.__flowTest.engine!.fit(80));
    await title.click();
    await expect(page.getByRole("textbox", { name: "Node label", exact: true })).toHaveValue("Commerce Services");
    await expect(container.locator("rect")).toHaveCount(1);
    expect(Number(await container.locator("rect").getAttribute("stroke-width"))).toBeGreaterThan(0);
    const borders = await page.locator('.flow-sdk-node[data-node-id="services"] div').evaluateAll(elements => elements.filter(element => {
      const style = getComputedStyle(element);
      return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].some(value => parseFloat(value) > 0);
    }).length);
    expect(borders).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("parent-surface.png") });
  });
}