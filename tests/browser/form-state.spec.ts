import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`independent state forms update view references without metadata at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=state");
    await page.waitForFunction(
      () => !!window.__flowTest?.engine?.getNodeBox("root.trigger"),
    );
    const originalView = await page.evaluate(() => window.__flowTest.document);
    await page.mouse.click(10, 10);
    await page
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-state/interface.ts");
    await expect(page.getByRole("status")).toContainText("4 form types loaded");
    await expect(
      page.locator('.flow-sdk-node [data-flow-property^="$"]'),
    ).toHaveCount(0);
    const assistantSummary = page.locator(
      '.flow-sdk-node[data-node-id="root.assistant"] [data-flow-config-summary]',
    );
    await expect(assistantSummary.locator("[data-flow-property]")).toHaveCount(
      9,
    );
    await expect(assistantSummary).toContainText("Knowledge Base");
    await expect(
      page.locator(
        '.flow-sdk-node[data-node-id="root.decision"] [data-flow-config-summary] [data-flow-property]',
      ),
    ).toHaveCount(3);
    await expect(
      page.locator(
        '.flow-sdk-node[data-node-id="root.addChannel"] [data-flow-config-summary] [data-flow-property]',
      ),
    ).toHaveCount(3);
    const open = async (address: string, label: string) => {
      const node = page.locator(`.flow-sdk-node[data-node-id="${address}"]`);
      await node.getByText(label, { exact: true }).first().click();
      await node
        .getByRole("button", { name: `Configure ${label}`, exact: true })
        .click();
      return page.getByRole("dialog", {
        name: `Configure ${label}`,
        exact: true,
      });
    };
    let dialog = await open("root.trigger", "On Create User");
    await expect(
      dialog.getByRole("textbox", { name: "Event", exact: true }),
    ).toHaveValue("user.created");
    await dialog
      .getByRole("combobox", { name: "Type", exact: true })
      .selectOption({ label: "Schedule" });
    await expect(
      dialog.getByRole("textbox", { name: "Event", exact: true }),
    ).toHaveCount(0);
    const cron = dialog.getByRole("textbox", { name: "Cron", exact: true });
    await expect(cron).toHaveAttribute("aria-required", "true");
    await cron.fill("0 9 * * 1-5");
    await cron.press("Enter");
    await dialog
      .getByRole("button", { name: "Close node configuration" })
      .click();
    await expect(
      page.locator(
        '.flow-sdk-node[data-node-id="root.trigger"] [data-flow-icon-caption]',
      ),
    ).toHaveText("On Create User");
    dialog = await open("root.assistant", "AI Agent");
    await expect(
      dialog.getByRole("combobox", { name: "Model", exact: true }),
    ).toBeEnabled();
    await expect(
      dialog
        .getByRole("combobox", { name: "Model", exact: true })
        .locator("option:not([disabled])"),
    ).toHaveText(["Example Model"]);
    const prompt = dialog.getByRole("textbox", { name: "Prompt", exact: true });
    await prompt.fill("Review the employee role.");
    await prompt.press("Tab");
    await dialog
      .getByRole("group", { name: "Knowledge Base", exact: true })
      .getByRole("button", { name: "Support Answers" })
      .click();
    await expect(prompt).toHaveValue("Review the employee role.");
    await dialog
      .getByRole("button", { name: "Close node configuration" })
      .click();
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.assistant"]'),
    ).toContainText("Review the employee role.");
    await expect(
      assistantSummary.locator('[data-flow-property="prompt"]'),
    ).toContainText("Review the employee role.");
    const state = await page.evaluate(() => window.__flowTest.formState);
    expect(state.trigger).toEqual({ type: "schedule", cron: "0 9 * * 1-5" });
    expect(state.steps[0].config.memory).toEqual([
      "knowledge_entry",
      "support_qa",
    ]);
    expect(JSON.stringify(state)).not.toContain('"$');
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      originalView,
    );
    expect(
      await page.evaluate(() =>
        window.__flowTest.events.filter((event) => event.name === "json"),
      ),
    ).toHaveLength(0);
    await page
      .getByRole("button", { name: "Background teal.500", exact: true })
      .click();
    expect(await page.evaluate(() => window.__flowTest.formState)).toEqual(
      state,
    );
    expect(
      await page.evaluate(() => window.__flowTest.document.assistant.$content),
    ).toEqual(originalView.assistant.$content);
    expect(
      await page.evaluate(() => window.__flowTest.document.assistant.$bgColor),
    ).toBe("teal.500");
    dialog = await open("root.assistant", "AI Agent");
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(
      dialog.getByRole("textbox", { name: "Prompt", exact: true }),
    ).toBeDisabled();
    await dialog
      .getByRole("button", { name: "Close node configuration" })
      .click();
    await page.screenshot({
      path: testInfo.outputPath("independent-workflow.png"),
    });
  });
}
