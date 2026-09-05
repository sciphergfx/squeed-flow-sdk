import { expect, test } from "@playwright/test";
import { ready, chooseToolbarOption } from "./helpers";

for (const colorMode of ["light", "dark"] as const) {
  test(`toolbar fades follow overflow in ${colorMode}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate(
      (colorMode) => window.__flowTest.configure({ colorMode }),
      colorMode,
    );
    await page.locator('.flow-sdk-node[data-node-id="alpha"] p[title]').click();
    const panel = page.locator("[data-flow-toolbar-scroll]");
    const left = page.locator('[data-flow-toolbar-fade="left"]');
    const right = page.locator('[data-flow-toolbar-fade="right"]');
    await expect(left).toHaveCSS("opacity", "0");
    await expect(right).toHaveCSS("opacity", "1");
    for (const fade of [left, right]) {
      await expect(fade).toHaveCSS("pointer-events", "none");
      await expect(fade).toHaveCSS("width", "20px");
      await expect(fade).toHaveCSS("background-image", /linear-gradient/);
    }
    const radius = page.getByRole("combobox", {
      name: "Node border radius",
      exact: true,
    });
    await expect(radius).toHaveCSS("width", "36px");
    await expect(radius.locator("svg")).toHaveCount(1);
    await expect
      .poll(() =>
        radius.evaluate((element) => {
          const arc = element.querySelector("svg")!;
          const neighbor = document.querySelector(
            '[aria-label="Toggle node outline"]',
          )!;
          return (
            getComputedStyle(arc).color === getComputedStyle(neighbor).color
          );
        }),
      )
      .toBe(true);
    await panel.evaluate((element) => {
      element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
    });
    await expect(left).toHaveCSS("opacity", "1");
    await expect(right).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("toolbar-fades.png") });
    await panel.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect(right).toHaveCSS("opacity", "0");
    await expect(left).toHaveCSS("opacity", "1");
    await page.setViewportSize({ width: 2200, height: 950 });
    await expect(left).toHaveCSS("opacity", "0");
    await expect(right).toHaveCSS("opacity", "0");
    await page.mouse.click(10, 10);
    const mode = page.getByRole("combobox", { name: "Edge mode", exact: true });
    await expect(mode).toHaveCSS("width", "36px");
    expect(
      await mode.evaluate((element) =>
        element.previousElementSibling?.getAttribute("role"),
      ),
    ).toBe("separator");
    const separators = panel.getByRole("separator");
    await expect(separators).toHaveCount(4);
    for (const separator of await separators.all()) {
      await expect(separator).toBeVisible();
      await expect(separator).toHaveCSS("width", "1px");
      await expect(separator).toHaveCSS("height", "20px");
    }
    await chooseToolbarOption(mode, "Properties");
    await expect(
      page.getByRole("button", {
        name: "Upload workflow interface",
        exact: true,
      }),
    ).toBeVisible();
  });
}
