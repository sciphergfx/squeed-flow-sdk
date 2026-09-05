import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`node radius presets, custom input and reset at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json");
    const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    await node.locator("p").first().click();
    const original = await page.evaluate(() => structuredClone(window.__flowTest.document));
    const picker = page.getByRole("combobox", { name: "Node border radius", exact: true });
    const surface = node.locator("[data-flow-node-surface]").first();
    for (const radius of [30, 0]) {
      await picker.selectOption(String(radius));
      await expect(surface).toHaveCSS("border-top-left-radius", `${radius}px`);
      expect(await page.evaluate(() => window.__flowTest.document.alpha.$borderRadius)).toBe(radius);
    }
    await picker.selectOption("custom");
    const input = page.getByRole("spinbutton", { name: "Custom border radius", exact: true });
    await input.fill("23");
    await input.press("Enter");
    await expect(surface).toHaveCSS("border-top-left-radius", "23px");
    await input.fill("-1");
    await input.press("Enter");
    await expect(surface).toHaveCSS("border-top-left-radius", "23px");
    await picker.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("radius-toolbar.png") });
    await picker.selectOption("");
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(original);
    await page.evaluate(() => window.__flowTest.configure({ isMultiSelectMode: true }));
    await page.locator('.flow-sdk-node[data-node-id="root.beta"] p').first().click();
    await picker.selectOption("16");
    expect(await page.evaluate(() => [window.__flowTest.document.alpha.$borderRadius, window.__flowTest.document.beta.$borderRadius])).toEqual([16, 16]);
    await page.evaluate(() => window.__flowTest.configure({ selectionToolbar: { hide: ["style"] } }));
    await expect(picker).toHaveCount(0);
  });
}

test("edge shape selector stays transparent in both themes", async ({ page }) => {
  await ready(page);
  await page.locator(".flow-sdk-edge").first().dispatchEvent("click");
  const picker = page.getByRole("combobox", { name: "Edge shape", exact: true });
  for (const colorMode of ["light", "dark"] as const) {
    await page.evaluate(colorMode => window.__flowTest.configure({ colorMode }), colorMode);
    await expect(picker).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await picker.hover();
    await expect(picker).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
});