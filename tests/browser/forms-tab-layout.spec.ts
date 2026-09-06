import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`forms tabs keep action helpers aligned and controls below fields at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await chooseToolbarOption(page.getByRole("combobox", { name: "Example dataset", exact: true }), "Workflow State 3");
    const panel = page.getByRole("region", { name: "SDK control examples", exact: true });
    const configuration = panel.getByRole("group", { name: "Diagram configuration", exact: true });
    for (const section of ["Bindings", "Design", "Files"]) {
      await configuration.getByRole("tab", { name: section, exact: true }).click();
      const labels = configuration.locator("[data-configuration-label]");
      expect(await labels.count()).toBeGreaterThan(0);
      expect(await labels.locator('svg[aria-hidden="true"]').count()).toBe(await labels.count());
      const overflow = await configuration.evaluate(element => [...element.querySelectorAll('label, [data-configuration-label]')].filter(label => label.getBoundingClientRect().right > element.getBoundingClientRect().right + 1).length);
      expect(overflow).toBe(0);
      const footer = panel.getByRole("group", { name: "Form actions", exact: true });
      await footer.scrollIntoViewIfNeeded();
      const geometry = await panel.evaluate(element => {
        const controls = element.querySelector('[aria-label="Diagram configuration"]')!.getBoundingClientRect();
        const resources = element.querySelector('[aria-label="Reusable configuration"]')!.getBoundingClientRect();
        const actions = element.querySelector('[aria-label="Form actions"]')!.getBoundingClientRect();
        const bounds = element.getBoundingClientRect();
        return { bottom: Math.max(controls.bottom, resources.bottom), actionsTop: actions.top, left: controls.left - bounds.left, right: bounds.right - controls.right };
      });
      expect(geometry.actionsTop).toBeGreaterThanOrEqual(geometry.bottom);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeGreaterThanOrEqual(0);
      const actions = section === "Design" ? ["Add group", "Apply diagram configuration"] : section === "Files" ? ["Save diagram draft", "Restore diagram draft", "Remove saved diagram draft", "Apply diagram configuration"] : ["Apply diagram configuration"];
      for (const action of actions) {
        const row = configuration.locator(`[data-action-row="${action}"]`);
        await row.scrollIntoViewIfNeeded();
        const button = row.getByRole("button", { name: action, exact: true });
        await expect(button).toHaveAttribute("aria-describedby", /.+/);
        const bounds = await row.evaluate(element => {
          const button = element.querySelector("button")!.getBoundingClientRect();
          const description = element.lastElementChild!.getBoundingClientRect();
          return { gap: description.left - button.right, centerDelta: Math.abs((description.top + description.bottom - button.top - button.bottom) / 2), right: description.right };
        });
        expect(bounds.gap).toBeGreaterThanOrEqual(8);
        expect(bounds.centerDelta).toBeLessThan(1);
        expect(bounds.right).toBeLessThanOrEqual(width);
      }
      if (section === "Design") {
        await configuration.getByRole("button", { name: "Add group", exact: true }).click();
        await expect(configuration.getByRole("textbox", { name: "Group group_1 label", exact: true })).toHaveValue("Group 1");
        await configuration.getByRole("button", { name: "Apply diagram configuration", exact: true }).click();
        await expect(configuration.getByRole("alert")).toHaveCount(0);
      }
      await configuration.getByRole("tab", { name: section, exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/squeed-forms-${section.toLowerCase()}-${width}.png` });
    }
  });
}