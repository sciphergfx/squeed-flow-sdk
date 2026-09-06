import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`deleting an AI Agent attachment removes its reference at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await page.getByRole("combobox", { name: "Example dataset", exact: true }).click();
    await page.getByRole("listbox", { name: "Example dataset", exact: true })
      .getByRole("option", { name: "Workflow State", exact: true }).click();
    const attachments = [
      ["promptId", "user_review", "prompt"],
      ["tools", "directory_lookup", "directoryTool"],
      ["tools", "issue_lookup", "issueTool"],
      ["model", "example-model", "model"],
      ["memory", "knowledge_entry", "knowledgeMemory"],
      ["instructionIds", "directory_guidance", "instructions"],
    ];
    for (const [field, id, target] of attachments) {
      const property = `resource:${field}:${id}`;
      await page.locator(`.flow-sdk-edge-label[data-source-property="${property}"]`).click();
      if (field === "model") await page.keyboard.press("Delete");
      else await page.getByRole("button", { name: "Delete edge", exact: true }).click();
      await expect(page.locator(`.flow-sdk-edge[data-source-property="${property}"]`)).toHaveCount(0);
      await expect(page.locator(`.flow-sdk-node[data-node-id="root.${target}"]`)).toHaveCount(1);
    }
    await expect(page.locator('.flow-sdk-node[data-node-id="root.assistant"]')).toHaveCount(1);
    await page.locator('.flow-sdk-node[data-node-id="root.trigger"]')
      .getByText("On Create User", { exact: true }).dblclick();
    await page.getByRole("dialog", { name: "Configure On Create User", exact: true })
      .getByRole("combobox", { name: "Type", exact: true }).selectOption({ label: "Manual" });
    await page.keyboard.press("Escape");
    await expect(page.locator('.flow-sdk-edge[data-source-property^="resource:"]')).toHaveCount(0);
    await page.getByRole("button", { name: "View state", exact: true }).click();
    const state = JSON.parse((await page.getByTestId("squeed-json").textContent())!);
    expect(state.steps[0].config).not.toHaveProperty("promptId");
    expect(state.steps[0].config).not.toHaveProperty("model");
    expect(state.steps[0].config.tools).toEqual([]);
    expect(state.steps[0].config.memory).toEqual([]);
    expect(state.steps[0].config.instructionIds).toEqual([]);
    expect(Object.keys(state.tools)).toHaveLength(2);
    expect(Object.keys(state.models)).toHaveLength(1);
    expect(Object.keys(state.memorySources)).toHaveLength(2);
    expect(state.texts.user_review).toBeDefined();
    expect(state.texts.directory_guidance).toBeDefined();
    expect(errors).toEqual([]);
    await page.screenshot({ path: test.info().outputPath("attachment-deleted.png") });
  });
}