import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const coverage = JSON.parse(readFileSync("examples/workflow-form/coverage.json", "utf8")) as { enabledStepTypes: string[] };

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`all editor step configs open as separate nodes at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator(".flow-sdk-node").first()).toBeVisible();
    const pick = async (name: string, value: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page.getByRole("listbox", { name, exact: true }).getByRole("option", { name: value, exact: true }).click();
    };
    await pick("Example dataset", "Config Catalog");
    await expect(page.getByRole("combobox", { name: "Configuration type", exact: true })).toBeVisible();
    for (const type of coverage.enabledStepTypes) {
      const label = type.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join(" ");
      await pick("Configuration type", label);
      const node = page.locator(`.flow-sdk-node[data-node-id="root.config_${type}"]`);
      await expect(node.locator('[aria-haspopup="dialog"]')).toHaveCount(1);
      await node.getByText(`${label} Config`, { exact: true }).dblclick();
      const form = page.getByRole("dialog", { name: `Configure ${label} Config`, exact: true });
      await expect(form).toBeVisible();
      expect(await form.locator("[data-form-field]").count()).toBeGreaterThan(0);
      if (type === "custom") {
        const editor = form.getByRole("textbox", { name: "Configuration", exact: true });
        await editor.fill('{"nested":{"active":false,"count":0},"values":[1,null,"text"]}');
        await editor.press("Tab");
        await expect(editor).toHaveAttribute("aria-invalid", "false");
      }
      if (type === "custom" || type === "llm")
        await page.screenshot({ path: test.info().outputPath(`${type}-config.png`) });
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "View state", exact: true }).click();
    const inspector = page.getByTestId("squeed-json");
    await expect(inspector).toContainText('"active": false');
    const state = JSON.parse((await inspector.textContent())!);
    expect(state.configs.custom.config).toEqual({ nested: { active: false, count: 0 }, values: [1, null, "text"] });
    expect(state.steps.filter((step: { configRef: string }) => step.configRef === "http")).toHaveLength(2);
    expect(Object.keys(state.configs)).toHaveLength(coverage.enabledStepTypes.length);
    expect(errors).toEqual([]);
  });
}