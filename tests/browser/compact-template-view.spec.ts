import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const workflow = JSON.parse(readFileSync("examples/workflow-state-2/workflow.json", "utf8"));
test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`normalize status reveals mapped template rows and returns to icon at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const pick = async (name: string, value: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page.getByRole("listbox", { name, exact: true }).getByRole("option", { name: value, exact: true }).click();
    };
    await pick("Example dataset", "Workflow State 2");
    const result = page.locator('.flow-sdk-edge[data-source-property="template:result.status"][data-target-property="value"]');
    const output = page.locator('.flow-sdk-edge[data-source-property="template:output.status"][data-target-property="value"]');
    await expect(result).toHaveCount(1);
    await expect(output).toHaveCount(1);
    await expect(page.locator('.flow-sdk-node[data-node-id="root.template_input"] [data-flow-property="prompt"]:not([data-flow-port-side])')).toContainText("{{input.prompt}}");
    await expect(page.locator('.flow-sdk-edge[data-target-property="config:prompt"]')).toHaveCount(1);
    await expect(page.locator('.flow-sdk-edge[data-target-property="config:model"]')).toHaveCount(1);
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export resolved workflow", exact: true }).click();
    expect(JSON.parse(readFileSync((await (await pending).path())!, "utf8"))).toEqual(workflow);
    await pick("Workflow step", "Normalize Status");
    await pick("Control examples", "Controls");
    const node = page.locator('.flow-sdk-node[data-node-id="root.step_normalize_status"]');
    await expect(node.locator("[data-flow-config-summary]")).toHaveCount(0);
    const dot = node.getByRole("button", { name: "Show properties", exact: true });
    const nodeBounds = (await node.boundingBox())!;
    expect((await dot.boundingBox())!.x).toBeGreaterThanOrEqual(nodeBounds.x + nodeBounds.width - 1);
    await dot.click();
    const value = node.locator('[data-flow-node-surface] [data-flow-property="value"]');
    await expect(value).toContainText("{{steps.agent_act.result.status || steps.agent_act.output.status}}");
    await expect(node.locator("[data-flow-config-summary]")).toHaveCount(0);
    await expect(node.locator('[data-property="value"][data-port-role="target"]')).toHaveCount(1);
    await expect.poll(async () => {
      const row = (await value.boundingBox())!;
      const port = (await node.locator('[data-property="value"][data-port-role="target"]').boundingBox())!;
      return Math.abs(row.y + row.height / 2 - port.y - port.height / 2);
    }).toBeLessThan(1);
    await expect(result).toHaveCount(1);
    await expect(output).toHaveCount(1);
    await pick("Control examples", "Forms");
    await pick("Workflow step", "Normalize Status");
    await pick("Control examples", "Controls");
    await page.screenshot({ path: test.info().outputPath("normalize-object-view.png") });
    await node.getByRole("button", { name: "Show icon", exact: true }).click();
    await expect(value).toHaveCount(0);
    await expect(node.locator("[data-flow-config-summary]")).toHaveCount(0);
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(1);
    await expect(result).toHaveCount(1);
    await expect(output).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}