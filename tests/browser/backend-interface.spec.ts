import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`backend interface exposes validator options at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=json");
    await page.waitForFunction(() => !!window.__flowTest?.engine?.getNodeBox("root.workflow"));
    await page.mouse.click(10, 10);
    await page.getByLabel("Workflow interface file", { exact: true }).setInputFiles("examples/workflow-form/backend-interface.ts");
    await expect(page.getByRole("status")).toContainText("2 form types loaded");
    const node = page.locator('.flow-sdk-node[data-node-id="root.workflow"]');
    await node.getByText("Workflow", { exact: true }).click();
    await node.getByRole("button", { name: "Configure Workflow", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Configure Workflow", exact: true });
    const trigger = form.getByRole("combobox", { name: "Trigger", exact: true });
    await expect(trigger.locator("option:not([disabled])")).toHaveText(["Manual", "Event", "Schedule", "Webhook", "Api", "Auto", "On Violation"]);
    await trigger.selectOption({ label: "Api" });
    await expect.poll(() => page.evaluate(() => window.__flowTest.document.workflow.trigger)).toBe("api");
    const mode = form.getByRole("combobox", { name: "Execution Mode", exact: true });
    await mode.selectOption({ label: "Hybrid" });
    await expect.poll(() => page.evaluate(() => window.__flowTest.document.workflow.executionMode)).toBe("hybrid");
    await expect(form.getByRole("textbox", { name: "Id", exact: true })).toHaveAttribute("aria-required", "true");
    await expect(form.getByRole("group", { name: "Is Public", exact: true })).toHaveCount(0);
  });
}