import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`technical dropdown labels preserve addresses and identifiers at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const dataset = page.getByRole("combobox", {
      name: "Example dataset",
      exact: true,
    });
    await chooseToolbarOption(dataset, "Workflow State 2");
    const categories = page.getByRole("combobox", {
      name: "Control examples",
      exact: true,
    });
    await chooseToolbarOption(categories, "Viewport");
    await expect(categories).toContainText("Viewport");
    const node = page.getByRole("combobox", {
      name: "Example node",
      exact: true,
    });
    await chooseToolbarOption(node, "root.trigger");
    await expect(node).toHaveText("root.trigger");
    await chooseToolbarOption(node, "root.step_agent_act");
    await expect(node).toHaveText("root.step_agent_act");
    await chooseToolbarOption(categories, "Selection");
    await expect(node).toHaveText("root.step_agent_act");
    await chooseToolbarOption(categories, "Forms");
    const step = page.getByRole("combobox", {
      name: "Workflow step",
      exact: true,
    });
    await chooseToolbarOption(step, "agent_act");
    await expect(step).toHaveText("agent_act");
    for (const [name, value] of [
      ["Collection", "root.workflow.steps"],
      ["Dependency field", "dependsOn"],
      ["Dependency input", "input:input"],
      ["Interface: browser", "CastBrowserConfig"],
    ]) {
      const selector = page.getByRole("combobox", { name, exact: true });
      await expect(selector).toHaveText(value);
      await selector.click();
      const menu = page.getByRole("listbox", { name, exact: true });
      await expect(
        menu.getByRole("option", { name: value, exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Escape");
    }
    const mapping = page.getByRole("combobox", {
      name: "Mapping interface",
      exact: true,
    });
    await mapping.click();
    await expect(
      page
        .getByRole("listbox", { name: "Mapping interface", exact: true })
        .getByRole("option", { name: "CastBrowserConfig", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("group", { name: "Diagram configuration", exact: true })
      .getByRole("tab", { name: "Design", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Default view", exact: true }),
    ).toHaveText("Icon Label");
    await chooseToolbarOption(dataset, "Config Catalog");
    const type = page.getByRole("combobox", {
      name: "Configuration type",
      exact: true,
    });
    await chooseToolbarOption(type, "backflow_tool");
    await expect(type).toHaveText("backflow_tool");
    await page.screenshot({
      path: `/tmp/squeed-dropdown-identifiers-${width}.png`,
    });
  });
}
