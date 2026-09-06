import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`form fields fade without scrolling the header at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator(".flow-sdk-node").first()).toBeVisible();
    const pick = async (name: string, option: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page
        .getByRole("listbox", { name, exact: true })
        .getByRole("option", { name: option, exact: true })
        .click();
    };
    await pick("Example dataset", "Workflow State");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.assistant"]'),
    ).toBeVisible();
    await pick("Control examples", "Forms");
    await page
      .getByRole("region", { name: "SDK control examples" })
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-state/interface.ts");
    const node = page.locator('.flow-sdk-node[data-node-id="root.assistant"]');
    await expect(node.locator('[aria-haspopup="dialog"]')).toHaveCount(1);
    await expect(page.locator("[data-flow-config-summary]")).toHaveCount(0);
    await pick("Control examples", "Controls");
    await expect(page.getByRole("button", { name: /^Configure / })).toHaveCount(
      0,
    );
    await node.getByText("AI Agent", { exact: true }).first().dblclick();
    const dialog = page.getByRole("dialog", {
      name: "Configure AI Agent",
      exact: true,
    });
    const content = dialog.locator("[data-form-scroll]");
    await expect(dialog).toHaveCSS("font-size", "16px");
    await expect(content.locator("label").first()).toHaveCSS("font-size", "15px");
    const firstControl = content.locator('input:not([type="checkbox"]), textarea, select').first();
    await expect(firstControl).toHaveCSS("font-size", "16px");
    await expect(firstControl).toHaveCSS("padding-top", "10px");
    await expect(firstControl).toHaveCSS("padding-left", "14px");
    await expect(content).toHaveCSS("mask-image", /linear-gradient.*32px/);
    await expect(content).toHaveCSS("padding-top", "32px");
    await expect(content).toHaveCSS("padding-bottom", "32px");
    for (const summary of await content
      .locator("details:not([open]) > summary")
      .all())
      await summary.click();
    await content.evaluate((element) => {
      element.scrollTop = 0;
    });
    const close = dialog.getByRole("button", {
      name: "Close node configuration",
    });
    const headerTop = (await close.boundingBox())!.y;
    await expect
      .poll(() =>
        content.evaluate(
          (element) => element.scrollHeight - element.clientHeight,
        ),
      )
      .toBeGreaterThan(0);
    await content.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    expect((await close.boundingBox())!.y).toBe(headerTop);
    await expect(close).toBeInViewport();
    await dialog.screenshot({
      path: test.info().outputPath("form-vignette.png"),
    });
    await close.click();
    await expect(dialog).not.toBeVisible();
    const conditional = page.locator(
      '.flow-sdk-node[data-node-id="root.decision"]',
    );
    await conditional.getByText("Is a manager?", { exact: true }).dblclick();
    const conditionalForm = page.getByRole("dialog", {
      name: "Configure Is a manager?",
      exact: true,
    });
    await expect(conditionalForm).toBeVisible();
    const condition = conditionalForm.getByRole("textbox", {
      name: "Condition",
      exact: true,
    });
    await condition.fill("return input.isManager === false;");
    await condition.press("Tab");
    await conditionalForm
      .getByRole("button", { name: "Close node configuration" })
      .click();
    const keyboardTarget = conditional.locator('[aria-haspopup="dialog"]');
    await expect(keyboardTarget).toBeFocused();
    await keyboardTarget.press("Enter");
    await expect(condition).toHaveValue("return input.isManager === false;");
    await page.keyboard.press("Escape");
    await expect(conditionalForm).not.toBeVisible();
  });
}
