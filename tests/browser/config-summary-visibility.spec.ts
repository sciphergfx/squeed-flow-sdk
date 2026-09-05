import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`content hides form configuration until property view at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=state");
    await page.waitForFunction(() => !!window.__flowTest?.engine);
    await page.evaluate(() => {
      window.__flowTest.configure({
        formSchema: {
          LlmConfig: {
            kind: "object",
            properties: {
              model: { type: { kind: "string" }, optional: false },
            },
          },
        },
      });
      window.__flowTest.replaceDocument({
        ...window.__flowTest.document,
        assistant: {
          $label: "Content node",
          $content: "Main content",
        },
      });
    });
    const node = page.locator('.flow-sdk-node[data-node-id="root.assistant"]');
    await expect(node.locator('[aria-haspopup="dialog"]')).toHaveCount(1);
    await expect(node.locator("[data-flow-content]")).toHaveText(
      "Main content",
    );
    await expect(node.locator("[data-flow-config-summary]")).toHaveCount(0);
    await expect(node).not.toContainText("example-model");
    await page.evaluate(() =>
      window.__flowTest.engine!.focusNode("root.assistant", 70),
    );
    await node.getByText("Content node", { exact: true }).dblclick();
    const form = page.getByRole("dialog", {
      name: "Configure Content node",
      exact: true,
    });
    await expect(
      form
        .getByRole("combobox", { name: "Model", exact: true })
        .locator("option:checked"),
    ).toHaveText("Example Model");
    await page.keyboard.press("Escape");
    await node
      .getByRole("button", { name: "Show properties", exact: true })
      .click();
    await expect(node.locator("[data-flow-config-summary]")).toContainText(
      "example-model",
    );
    await expect(node.locator("[data-flow-content]")).toHaveCount(0);
    await node
      .getByRole("button", { name: "Show content", exact: true })
      .click();
    await expect(node.locator("[data-flow-config-summary]")).toHaveCount(0);
    await expect(node.locator("[data-flow-content]")).toHaveText(
      "Main content",
    );
  });
}
