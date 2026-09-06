import { expect, test, type Page } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

async function pick(page: Page, name: string, value: string) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page
    .getByRole("listbox", { name, exact: true })
    .getByRole("option", { name: value, exact: true })
    .click();
}

for (const width of [1440, 390]) {
  test(`raw selected Type view restores None at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await pick(page, "Example dataset", "Default");
    const node = page.locator('.flow-sdk-node[data-node-id="process"]');
    await node.locator("[data-flow-node-surface]").click();
    const selector = page.getByRole("combobox", {
      name: "Type view",
      exact: true,
    });
    await selector.click();
    const menu = page.getByRole("listbox", { name: "Type view", exact: true });
    await expect(
      menu.getByRole("option", { name: "None", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(menu.getByRole("option")).toHaveText([
      "None",
      "Icon Label",
      "Object",
      "Text",
    ]);
    await menu.getByRole("option", { name: "Icon Label", exact: true }).click();
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(1);
    await pick(page, "Type view", "Text");
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(0);
    await expect(node.locator('[data-flow-property="status"]')).toHaveCount(0);
    await pick(page, "Type view", "Object");
    await expect(node.locator('[data-flow-property="status"]')).toHaveCount(1);
    await pick(page, "Type view", "None");
    await expect(node.locator('[data-flow-property="status"]')).toHaveCount(1);
    await expect(selector).toHaveAttribute(
      "title",
      "Type view: None (default)",
    );
    await expect(page.locator(".flow-sdk-node")).toHaveCount(4);
    await selector.click();
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: test.info().outputPath(`type-view-${width}.png`),
    });
    expect(errors).toEqual([]);
  });

  test(`configured selected Type view keeps forms at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await pick(page, "Example dataset", "Workflow State 2");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.template_execution"]'),
    ).toHaveCount(1);
    await pick(page, "Workflow step", "normalize_status");
    await pick(page, "Control examples", "Controls");
    const node = page.locator(
      '.flow-sdk-node[data-node-id="root.step_normalize_status"]',
    );
    await node.locator("[data-flow-node-surface]").click();
    await pick(page, "Type view", "Icon Label");
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(1);
    await pick(page, "Type view", "Text");
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(0);
    await pick(page, "Type view", "Object");
    await expect(node).toContainText("value");
    await pick(page, "Type view", "None");
    await expect(
      page.getByRole("combobox", { name: "Type view", exact: true }),
    ).toHaveAttribute("title", "Type view: None (default)");
    await expect(node).toContainText("normalize_status");
    expect(errors).toEqual([]);
  });
}
