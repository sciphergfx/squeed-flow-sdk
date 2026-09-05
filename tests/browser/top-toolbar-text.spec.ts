import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");
for (const width of [1440, 390]) {
  test(`selected toolbar labels match collapsed direction text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    for (const mode of ["dark", "light"]) {
      if (mode === "light") await page.getByTestId("theme-toggle").click();
      const direction = page.locator("[data-flow-direction-control] p");
      await expect(direction).toBeVisible();
      const style = await direction.evaluate(element => {
        const computed = getComputedStyle(element);
        return { color: computed.color, fontSize: computed.fontSize, fontWeight: computed.fontWeight, fontFamily: computed.fontFamily, lineHeight: computed.lineHeight };
      });
      for (const name of ["Example dataset", "Control examples"]) {
        const trigger = page.getByRole("combobox", { name, exact: true });
        const label = trigger.locator("[data-example-trigger-label]");
        await expect(label).toHaveCSS("color", style.color);
        await expect(label).toHaveCSS("font-size", style.fontSize);
        await expect(label).toHaveCSS("font-weight", style.fontWeight);
        await expect(label).toHaveCSS("font-family", style.fontFamily);
        await expect(label).toHaveCSS("line-height", style.lineHeight);
        expect(await trigger.evaluate(element => element.querySelector('[data-example-trigger-label]')!.getBoundingClientRect().left >= element.querySelector('svg')!.getBoundingClientRect().right)).toBe(true);
      }
    }
    await page.screenshot({ path: test.info().outputPath("toolbar-text.png") });
  });
}