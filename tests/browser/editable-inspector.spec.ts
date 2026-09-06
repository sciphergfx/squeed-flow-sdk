import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`JSON and state edits update the view without accepting invalid drafts at ${width}px`, async ({
    page,
  }) => {
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
    await page.getByRole("button", { name: "View JSON", exact: true }).click();
    const json = page.getByRole("textbox", { name: "JSON JSON", exact: true });
    const view = JSON.parse(await json.inputValue());
    view.step_find.$label = "Edited document";
    await json.fill(JSON.stringify(view, null, 2));
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.step_find"]'),
    ).toContainText("Edited document");
    await json.fill('{"broken":');
    await expect(json).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.step_find"]'),
    ).toContainText("Edited document");
    await json.fill(JSON.stringify(view, null, 2));
    await expect(json).toHaveAttribute("aria-invalid", "false");
    await page.getByRole("button", { name: "View state", exact: true }).click();
    const stateEditor = page.getByRole("textbox", {
      name: "State JSON",
      exact: true,
    });
    const state = JSON.parse(await stateEditor.inputValue());
    state.workflow.steps.find((step) => step.id === "normalize_status").name =
      "Edited state";
    await stateEditor.fill(JSON.stringify(state, null, 2));
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.step_normalize_status"]'),
    ).toContainText("Edited state");
    await expect(stateEditor).toHaveAttribute("aria-invalid", "false");
  });
}
