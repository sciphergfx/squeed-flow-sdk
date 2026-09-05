import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`bundled interface makes double-click forms available at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator(".flow-sdk-node").first()).toBeVisible();
    const pick = async (name: string, option: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page
        .getByRole("listbox", { name, exact: true })
        .getByRole("option", { name: option, exact: true })
        .click();
    };
    await pick("Example dataset", "Form Connection");
    const node = page.locator('.flow-sdk-node[data-node-id="root.form"]');
    await expect(node.locator("[data-flow-config-summary]")).toBeVisible();
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.ui"]'),
    ).toContainText("UI JSON");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.binding"]'),
    ).toContainText("SampleStep");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.interface"]'),
    ).toContainText("interface SampleStep");
    await expect(page.getByRole("button", { name: /^Configure / })).toHaveCount(
      0,
    );
    await node.getByText("Generated Form", { exact: true }).dblclick();
    const form = page.getByRole("dialog", {
      name: "Configure Generated Form",
      exact: true,
    });
    await expect(form).toBeVisible();
    const name = form.getByRole("textbox", { name: "Name", exact: true });
    await expect(name).toHaveValue("Email notification");
    await name.fill("Updated notification");
    await name.press("Enter");
    await form
      .getByRole("button", { name: "Close node configuration" })
      .click();
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.state"]'),
    ).toContainText("Updated notification");
    await page.getByRole("button", { name: "View state", exact: true }).click();
    await expect(page.getByTestId("squeed-json")).toContainText(
      "Updated notification",
    );
    await page.getByRole("button", { name: "View state", exact: true }).click();

    await pick("Control examples", "Forms");
    await page
      .getByRole("region", { name: "SDK control examples" })
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles({
        name: "sample.ts",
        mimeType: "text/plain",
        buffer: Buffer.from(
          "interface SampleStep { name: string; enabled: boolean; retries: number; note?: string; }",
        ),
      });
    await expect(node.locator("[data-flow-property=note]")).toHaveCount(1);
    await pick("Control examples", "Controls");
    await node.getByText("Generated Form", { exact: true }).dblclick();
    await expect(
      form.getByRole("textbox", { name: "Note", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await node.screenshot();
    await page.screenshot({
      path: test.info().outputPath("form-connection.png"),
    });

    await pick("Example dataset", "Workflow State");
    const conditional = page.locator(
      '.flow-sdk-node[data-node-id="root.decision"]',
    );
    await expect(conditional.locator('[aria-haspopup="dialog"]')).toHaveCount(
      1,
    );
    await expect(page.locator("[data-flow-config-summary]")).toHaveCount(0);
    await conditional.getByText("Is a manager?", { exact: true }).dblclick();
    await expect(
      page.getByRole("dialog", {
        name: "Configure Is a manager?",
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
