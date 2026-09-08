import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [390, 768, 1024, 1043, 1440, 1920]) {
  test(`bottom toolbar respects desktop half-screen cap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page);
    await page.evaluate(() => window.__flowTest.configure({ bottomBarCollapsed: false }));
    const bar = page.getByRole("toolbar", { name: "Diagram controls", exact: true });
    const scroll = bar.locator("[data-flow-toolbar-scroll]");
    const group = scroll.locator("..");
    await expect(scroll).toBeVisible();
    await expect.poll(() => group.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(width >= 1024 ? width / 2 : width);
    if (width < 1024) {
      await expect.poll(() => group.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(width / 2);
    }
    await expect.poll(() => scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await scroll.hover();
    await page.mouse.wheel(0, 240);
    await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(bar.locator('[data-flow-toolbar-fade="left"]')).toHaveCSS("opacity", "1");
    const collapse = bar.getByRole("button", { name: "Toggle toolbar collapse", exact: true });
    await collapse.scrollIntoViewIfNeeded();
    await expect(collapse).toBeInViewport();
    await expect(bar.getByRole("button", { name: "Direction", exact: true })).toBeInViewport();
    await page.evaluate(() => window.__flowTest.configure({ bottomBarCollapsed: true }));
    await page.evaluate(() => window.__flowTest.configure({ bottomBarCollapsed: false }));
    await expect.poll(() => group.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(width >= 1024 ? width / 2 : width);
    await page.screenshot({ path: test.info().outputPath(`bottom-toolbar-${width}.png`) });
  });
}