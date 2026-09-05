import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [684, 390, 320]) {
  test(`selection toolbar stays one row and scrolls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await ready(page);
    await page.locator('.flow-sdk-node[data-node-id="alpha"] p[title]').click();
    const panel = page.locator("[data-flow-toolbar-scroll]");
    await expect(panel).toHaveCSS("height", "50px");
    await expect(panel).toHaveCSS("overflow-x", "auto");
    await expect(panel).toHaveCSS("scrollbar-width", "none");
    const before = await panel.boundingBox();
    expect(before!.width).toBeLessThanOrEqual(width - 40);
    expect(
      await panel.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    const row = panel.locator(":scope > div");
    await expect(row).toHaveCSS("flex-wrap", "nowrap");
    const centers = await row.locator(":scope > *").evaluateAll((elements) =>
      elements
        .filter((element) => element.getBoundingClientRect().height > 0)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return rect.y + rect.height / 2;
        }),
    );
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
    const icon = panel.getByRole("textbox", { name: "Node icon", exact: true });
    await icon.focus();
    await expect
      .poll(() => panel.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    await icon.fill("PiGear");
    await icon.press("Enter");
    await expect(icon).toHaveValue("PiGear");
    await panel.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await panel
      .getByRole("button", { name: "Edit node border", exact: true })
      .click();
    await expect(panel).toHaveCSS("height", "50px");
    expect((await panel.boundingBox())!.width).toBeCloseTo(before!.width, 0);
    const thickness = panel.getByRole("spinbutton", {
      name: "Border thickness",
      exact: true,
    });
    await thickness.focus();
    await expect(thickness).toBeFocused();
    expect(
      await panel.evaluate(
        (element) => element.scrollHeight <= element.clientHeight + 1,
      ),
    ).toBe(true);
  });
}

test("normal and selected toolbars resize within the diagram container", async ({
  page,
}) => {
  await ready(page);
  const panel = page.locator("[data-flow-toolbar-scroll]");
  await page
    .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
    .click();
  for (const width of [684, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await panel.boundingBox();
    const direction = await page
      .getByRole("button", { name: "Direction", exact: true })
      .boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(20);
    expect(bounds!.x + bounds!.width).toBeLessThan(direction!.x);
    const surfaceGap = await panel.evaluate((element) => {
      const main = element.parentElement!.getBoundingClientRect();
      const direction = document
        .querySelector("[data-flow-direction-control]")!
        .getBoundingClientRect();
      return direction.left - main.right;
    });
    expect(surfaceGap - 16).toBeGreaterThanOrEqual(7.5);
    expect(direction!.x + direction!.width).toBeLessThanOrEqual(width - 20);
    await expect(panel).toHaveCSS("height", "50px");
    await expect(panel).toHaveCSS("scrollbar-width", "none");
  }
  await page.setViewportSize({ width: 1000, height: 844 });
  await page
    .getByRole("toolbar", { name: "Diagram controls" })
    .evaluate((element) => {
      (element.parentElement as HTMLElement).style.width = "320px";
    });
  expect((await panel.boundingBox())!.width).toBeLessThan(280);
  await page.locator('.flow-sdk-node[data-node-id="alpha"] p[title]').click();
  expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(280);
  await expect(panel).toHaveCSS("height", "50px");
  expect(
    await panel.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
});
