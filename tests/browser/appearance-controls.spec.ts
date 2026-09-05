import { expect, test } from "@playwright/test";
import { chooseToolbarOption, ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`spacing slider and backgrounds preserve graph data at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=connections");
    await page.mouse.click(10, 10);
    const original = await page.evaluate(() => structuredClone(window.__flowTest.document));
    const trigger = page.getByRole("combobox", { name: "Node spacing", exact: true });
    await trigger.click();
    const popup = page.getByRole("dialog", { name: "Node spacing", exact: true });
    const slider = popup.getByRole("slider", { name: "Node spacing percentage", exact: true });
    await expect(popup).toHaveCSS("border-radius", "30px");
    await expect(slider).toHaveValue("100");
    for (const themeColor of ["#e5484d", "#30a46c"]) {
      await page.evaluate(color => window.__flowTest.configure({ themeColor: color }), themeColor);
      await expect(slider).toHaveCSS("accent-color", themeColor === "#e5484d" ? "rgb(229, 72, 77)" : "rgb(48, 164, 108)");
    }
    const measure = () => page.evaluate(() => {
      const engine = window.__flowTest.engine!;
      const source = engine.getNodeBox("root.alpha")!;
      const target = engine.getNodeBox("root.beta")!;
      return { distance: Math.hypot(target.x - source.x, target.y - source.y), width: source.w, height: source.h, zoom: engine.zoom() };
    });
    const normal = await measure();
    await slider.press("Home");
    await expect(slider).toHaveValue("50");
    await expect.poll(async () => (await measure()).distance).toBeLessThan(normal.distance * 0.95);
    const compact = await measure();
    expect(compact.width).toBe(normal.width);
    expect(compact.height).toBe(normal.height);
    expect(compact.zoom).toBe(normal.zoom);
    const bounds = await slider.boundingBox();
    await page.mouse.move(bounds!.x + 8, bounds!.y + bounds!.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width - 8, bounds!.y + bounds!.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(150);
    await expect.poll(async () => (await measure()).distance).toBeGreaterThan(normal.distance * 1.05);
    await slider.fill("100");
    await expect.poll(async () => Math.abs((await measure()).distance - normal.distance)).toBeLessThan(0.1);
    await page.screenshot({ path: testInfo.outputPath("spacing-slider.png") });
    await slider.press("Escape");
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
    const background = page.getByRole("combobox", { name: "Background variant", exact: true });
    for (const [label, pattern] of [["Grid", "grid"], ["Steel", "steel"], ["Solid", "none"], ["Transparent", "none"], ["Dots", "dot"]]) {
      await chooseToolbarOption(background, label);
      await expect(page.locator("[data-flow-background]")).toHaveAttribute("data-flow-background", pattern);
      await expect(background.locator("svg")).toHaveAttribute("data-background-icon", label === "Transparent" ? "transparent" : pattern);
      if (label === "Transparent") await expect(page.locator("[data-flow-background]")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      if (label === "Dots") await expect(page.locator("[data-flow-background]")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    }
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(original);
    expect(await page.evaluate(() => window.__flowTest.events.some(event => event.name === "spacing" && event.value === 0.5))).toBe(true);
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(trigger).toBeDisabled();
    await expect(background).toBeDisabled();
  });
}

test("controlled appearance updates and spacing bounds", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.__flowTest.configure({ spacing: 1, backgroundVariant: "grid" }));
  await page.mouse.click(10, 10);
  await page.getByRole("combobox", { name: "Node spacing", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Node spacing percentage", exact: true });
  await slider.press("End");
  await expect(slider).toHaveValue("100");
  await page.evaluate(() => window.__flowTest.configure({ spacing: 1.5 }));
  await expect(slider).toHaveValue("150");
  await page.evaluate(() => window.__flowTest.configure({ spacing: -1 }));
  await expect(slider).toHaveValue("50");
  await slider.press("Escape");
  const background = page.getByRole("combobox", { name: "Background variant", exact: true });
  await chooseToolbarOption(background, "Transparent");
  await expect(background).toHaveAttribute("title", "Background: Grid");
  await page.evaluate(() => window.__flowTest.configure({ backgroundVariant: "transparent" }));
  await expect(background).toHaveAttribute("title", "Background: Transparent");
  await expect(page.locator("[data-flow-background]")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});