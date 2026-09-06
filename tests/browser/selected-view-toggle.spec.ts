import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`view switches appear only for selected nodes at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const pick = async (name: string, value: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page
        .getByRole("listbox", { name, exact: true })
        .getByRole("option", { name: value, exact: true })
        .click();
    };
    await pick("Example dataset", "Workflow State 2");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.template_execution"]'),
    ).toHaveCount(1);
    await pick("Workflow step", "Normalize Status");
    await pick("Control examples", "Controls");
    const node = page.locator(
      '.flow-sdk-node[data-node-id="root.step_normalize_status"]',
    );
    await expect(node.locator("[data-flow-content-toggle]")).toHaveCount(0);
    await node.locator("[data-flow-node-surface]").click();
    await expect(
      node.getByRole("button", { name: "Show properties", exact: true }),
    ).toBeVisible();
    await node
      .getByRole("button", { name: "Show properties", exact: true })
      .click();
    await expect(
      node.locator('[data-flow-inspection-row][data-flow-property="value"]'),
    ).toHaveCount(1);
    await expect(
      node.getByRole("button", { name: "Show icon", exact: true }),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Close selection tools", exact: true })
      .click();
    await expect(node.locator("[data-flow-content-toggle]")).toHaveCount(0);
    await expect(
      node.locator('[data-flow-inspection-row][data-flow-property="value"]'),
    ).toHaveCount(1);
    await node.locator("[data-flow-node-surface]").dispatchEvent("click");
    await node
      .getByRole("button", { name: "Show icon", exact: true })
      .dispatchEvent("click");
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
