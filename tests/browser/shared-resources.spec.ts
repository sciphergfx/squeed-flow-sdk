import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`tools, models, memory and text stay reusable outside steps at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=state");
    await page.waitForFunction(
      () => !!window.__flowTest?.engine?.getNodeBox("root.directoryTool"),
    );
    await page
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    await page
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-state/interface.ts");
    const tool = page.locator(
      '.flow-sdk-node[data-node-id="root.directoryTool"]',
    );
    await expect(tool.locator('[aria-haspopup="dialog"]')).toHaveCount(1);
    await expect(page.locator("[data-flow-config-summary]")).toHaveCount(0);
    await page.evaluate(() =>
      window.__flowTest.engine!.focusNode("root.directoryTool", 70),
    );
    await tool
      .locator("[data-flow-icon-caption]")
      .getByText("Directory Lookup", { exact: true })
      .dblclick();
    const form = page.getByRole("dialog", {
      name: "Configure Directory Lookup",
      exact: true,
    });
    const name = form.getByRole("textbox", { name: "Name", exact: true });
    await name.fill("Shared Directory");
    await name.press("Enter");
    await page
      .getByRole("button", { name: "Close node configuration" })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__flowTest.formState.tools.directory_lookup.name,
        ),
      )
      .toBe("Shared Directory");
    expect(
      await page.evaluate(
        () => window.__flowTest.formState.steps[0].config.tools,
      ),
    ).toEqual(["directory_lookup", "issue_lookup"]);

    for (const resource of [
      { id: "model", name: "Example Model", next: "Shared Model", collection: "models", key: "example-model" },
      { id: "knowledgeMemory", name: "Knowledge Entries", next: "Shared Knowledge", collection: "memorySources", key: "knowledge_entry" },
    ]) {
      await page.evaluate(id => window.__flowTest.engine!.focusNode(`root.${id}`, 70), resource.id);
      await page.locator(`.flow-sdk-node[data-node-id="root.${resource.id}"]`)
        .getByText(resource.name, { exact: true }).dblclick();
      const resourceForm = page.getByRole("dialog", { name: `Configure ${resource.name}`, exact: true });
      await resourceForm.getByRole("textbox", { name: "Name", exact: true }).fill(resource.next);
      await resourceForm.getByRole("textbox", { name: "Name", exact: true }).press("Enter");
      await page.getByRole("button", { name: "Close node configuration" }).click();
      await expect.poll(() => page.evaluate(({ collection, key }) =>
        window.__flowTest.formState[collection][key].name, resource)).toBe(resource.next);
    }

    const prompt = page.locator('.flow-sdk-node[data-node-id="root.prompt"]');
    await page.evaluate(() =>
      window.__flowTest.engine!.focusNode("root.prompt", 70),
    );
    await prompt.locator("[data-flow-content]").dblclick();
    const editor = prompt.getByRole("textbox", {
      name: "Node content",
      exact: true,
    });
    await editor.fill("Use the shared tools to review this user.");
    await editor.press("Control+Enter");
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__flowTest.formState.texts.user_review.content,
        ),
      )
      .toBe("Use the shared tools to review this user.");
    expect(
      await page.evaluate(
        () => window.__flowTest.formState.steps[0].config.promptId,
      ),
    ).toBe("user_review");
    expect(
      await page.evaluate(() => window.__flowTest.document.prompt.$content),
    ).toEqual({ $state: "root.texts.user_review.content" });
    await expect(prompt.locator('[aria-haspopup="dialog"]')).toHaveCount(0);

    await page.evaluate(() =>
      window.__flowTest.engine!.focusNode("root.assistant", 70),
    );
    await page
      .locator('.flow-sdk-node[data-node-id="root.assistant"]')
      .getByText("AI Agent", { exact: true })
      .first()
      .dblclick();
    const agent = page.getByRole("dialog", {
      name: "Configure AI Agent",
      exact: true,
    });
    await expect(agent).toBeVisible();
    for (const summary of await agent
      .locator("details:not([open]) > summary")
      .all())
      await summary.click();
    await expect(
      agent
        .getByRole("combobox", { name: "Prompt", exact: true })
        .locator("option:checked"),
    ).toHaveText("User Review Prompt");
    const toolChoice = agent.getByRole("button", {
      name: "Shared Directory",
      exact: true,
    });
    await expect(toolChoice).toHaveAttribute("aria-pressed", "true");
    await expect(agent.getByRole("combobox", { name: "Model", exact: true })
      .locator("option:checked")).toHaveText("Shared Model");
    await expect(agent.getByRole("button", { name: "Shared Knowledge", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await toolChoice.click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__flowTest.formState.steps[0].config.tools),
      )
      .toEqual(["issue_lookup"]);
    await page
      .getByRole("button", { name: "Close node configuration" })
      .click();
    await expect(tool).toHaveCount(1);
    await expect(
      page.locator(".flow-sdk-edge").filter({ has: page.locator("path") }),
    ).not.toHaveCount(0);
    await page.evaluate(() => window.__flowTest.engine!.centerAndFit(60));
    await tool.screenshot();
    await page.screenshot({
      path: test.info().outputPath("shared-resources.png"),
    });
  });
}
