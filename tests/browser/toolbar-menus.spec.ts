import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`toolbar menus show selected checks and remain usable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json");
    await page.mouse.click(10, 10);
    const mode = page.getByRole("combobox", { name: "Edge mode", exact: true });
    await mode.click();
    const menu = page.getByRole("listbox", { name: "Edge mode", exact: true });
    await expect(menu).toHaveCSS("border-radius", "30px");
    await expect(menu).toHaveCSS("box-shadow", /8px/);
    await expect(
      menu.getByRole("option", { name: "Nodes", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await menu.getByRole("option", { name: "Properties", exact: true }).click();
    await expect(menu).toBeHidden();
    await expect(mode).toHaveAttribute("title", "Connections: Properties");
    await mode.click();
    await expect(
      menu
        .getByRole("option", { name: "Properties", exact: true })
        .locator("svg"),
    ).toHaveCSS("visibility", "visible");
    const bounds = await menu.boundingBox();
    const toolbarTop = await mode.evaluate(
      (element) =>
        element
          .closest("[data-flow-toolbar-scroll]")!
          .parentElement!.getBoundingClientRect().top,
    );
    expect(toolbarTop - bounds!.y - bounds!.height).toBeCloseTo(24, 0);
    expect(bounds!.x).toBeGreaterThanOrEqual(12);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 12);
    await page.screenshot({ path: testInfo.outputPath("mode-menu.png") });
    await page.keyboard.press("Escape");
    await expect(mode).toBeFocused();
    await mode.press("ArrowDown");
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await expect(mode).toHaveAttribute("title", "Connections: Nodes");
    await page
      .locator('.flow-sdk-node[data-node-id="root.alpha"] p')
      .first()
      .click();
    const radius = page.getByRole("combobox", {
      name: "Node border radius",
      exact: true,
    });
    await radius.click();
    const radii = page.getByRole("listbox", {
      name: "Node border radius",
      exact: true,
    });
    await radii
      .getByRole("option", { name: "30px radius", exact: true })
      .click();
    expect(
      await page.evaluate(() => window.__flowTest.document.alpha.$borderRadius),
    ).toBe(30);
    await radius.click();
    await expect(
      radii.getByRole("option", { name: "30px radius", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await radii
      .getByRole("option", { name: "Custom radius", exact: true })
      .click();
    await expect(
      page.getByRole("spinbutton", {
        name: "Custom border radius",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Choose node icon", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Choose node icon",
      exact: true,
    });
    await expect(
      dialog.getByRole("tab", { name: "React icons", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await dialog
      .getByRole("tab", { name: "React icons", exact: true })
      .press("ArrowRight");
    await expect(
      dialog.getByRole("tab", { name: "Custom SVG", exact: true }),
    ).toBeFocused();
    await expect(
      dialog.getByRole("tabpanel", { name: "Custom SVG", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "SVG URL", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator(".flow-sdk-edge").first().dispatchEvent("click");
    const shape = page.getByRole("combobox", {
      name: "Edge shape",
      exact: true,
    });
    await shape.click();
    const shapes = page.getByRole("listbox", {
      name: "Edge shape",
      exact: true,
    });
    await shapes.getByRole("option", { name: "bezier", exact: true }).click();
    await shape.click();
    await expect(
      shapes.getByRole("option", { name: "bezier", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: testInfo.outputPath("shape-menu.png") });
    await page.mouse.click(5, 5);
    await expect(shapes).toBeHidden();
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(mode).toBeDisabled();
  });
}
