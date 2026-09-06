import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`connections toggle follows Draw mode and graph theme at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const toolbar = page.getByRole("toolbar", { name: "Diagram controls", exact: true });
    await expect(toolbar.getByRole("button").first()).toHaveAttribute("aria-label", "Pin");
    await toolbar.getByRole("button", { name: "Toggle toolbar collapse", exact: true }).click();
    const toggle = toolbar.getByRole("button", { name: "Only connected nodes", exact: true });
    const draw = toolbar.getByRole("button", { name: "Toggle draw mode", exact: true });
    const labels = await toolbar.getByRole("button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label")));
    expect(labels[0]).toBe("Pin");
    expect(labels.indexOf("Only connected nodes")).toBe(labels.indexOf("Toggle draw mode") + 1);
    expect(await toggle.evaluate(button => button.previousElementSibling?.getAttribute("role"))).toBe("separator");
    const color = () => toggle.evaluate(element => getComputedStyle(element).color);
    expect(await color()).toBe(await draw.evaluate(element => getComputedStyle(element).color));
    await page.mouse.click(8, 475);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    for (const theme of ["red.500", "green.500"]) {
      const swatch = toolbar.getByRole("button", { name: `Graph theme ${theme}`, exact: true });
      await swatch.click();
      const expected = await swatch.evaluate(element => getComputedStyle(element).backgroundColor);
      await expect.poll(color).toBe(expected);
    }
    await toggle.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath("connections-toggle.png") });
  });
}