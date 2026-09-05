import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires the SDK Test consumer");
test("top toolbar fades track overflow and match the bottom toolbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 950 });
  await page.goto(process.env.SDK_TEST_URL!);
  const top = page.getByRole("toolbar", { name: "Example controls", exact: true });
  const scroll = top.locator("[data-flow-toolbar-scroll]");
  const left = top.locator('[data-flow-toolbar-fade="left"]');
  const right = top.locator('[data-flow-toolbar-fade="right"]');
  await scroll.evaluate(element => { element.scrollLeft = 0; });
  await expect(left).toHaveCSS("opacity", "0");
  await expect(right).toHaveCSS("opacity", "1");
  await expect(right).toHaveCSS("pointer-events", "none");
  const bottomFade = page.getByRole("toolbar", { name: "Diagram controls", exact: true }).locator('[data-flow-toolbar-fade="right"]').first();
  await expect(right).toHaveCSS("background-image", await bottomFade.evaluate(element => getComputedStyle(element).backgroundImage));
  await page.screenshot({ path: test.info().outputPath("top-overflow-start.png") });
  await scroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await expect(left).toHaveCSS("opacity", "1");
  await expect(right).toHaveCSS("opacity", "0");
  await page.getByTestId("theme-toggle").click();
  await expect(right).toHaveCSS("background-image", await bottomFade.evaluate(element => getComputedStyle(element).backgroundImage));
  await page.setViewportSize({ width: 1440, height: 950 });
  await expect(left).toHaveCSS("opacity", "0");
  await expect(right).toHaveCSS("opacity", "0");
});