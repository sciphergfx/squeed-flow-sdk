import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`one Tools object keeps per-tool ports and deletion at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const pick = async (name: string, value: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page.getByRole("listbox", { name, exact: true }).getByRole("option", { name: value, exact: true }).click();
    };
    await pick("Example dataset", "Workflow State 2");
    await expect(page.locator('.flow-sdk-node[data-node-id="root.template_input"]')).toHaveCount(1);
    const tools = page.locator('.flow-sdk-node[data-node-id="root.tools"]');
    await expect(tools).toHaveCount(1);
    await expect(page.locator('.flow-sdk-node[data-node-id^="root.tool_"]')).toHaveCount(0);
    await expect(tools.locator("[data-flow-icon-label]")).toHaveCount(1);
    await expect(tools.locator('[data-flow-property^="output:browser_"]')).toHaveCount(0);
    await expect(page.locator('.flow-sdk-edge[data-target-property="config:tools"]')).toHaveCount(23);
    await pick("Control examples", "Viewport");
    await pick("Example node", "Root Tools");
    await page.getByRole("region", { name: "SDK control examples" }).getByRole("button", { name: "Focus node", exact: true }).click();
    await pick("Control examples", "Controls");
    await tools.getByRole("button", { name: "Show properties", exact: true }).click();
    await expect(tools.locator('[data-flow-property^="output:browser_"]')).toHaveCount(23);
    await expect(tools.locator(".flow-sdk-property-port")).toHaveCount(23);
    await expect(tools.locator("[data-flow-config-summary]")).toHaveCount(0);
    await page.getByRole("button", { name: "Close selection tools", exact: true }).click();
    await page.getByRole("button", { name: "Toggle toolbar collapse", exact: true }).click();
    await page.getByRole("button", { name: "Toggle draw mode", exact: true }).click();
    await expect(tools.locator(".flow-sdk-property-port")).toHaveCount(23);
    const offsets = await tools.evaluate(element => Array.from(element.querySelectorAll<HTMLElement>(".flow-sdk-property-port")).map(port => {
      const row = Array.from(element.querySelectorAll<HTMLElement>("[data-flow-property]")).find(candidate => candidate.dataset.flowProperty === port.dataset.property)!;
      const portBounds = port.getBoundingClientRect(), rowBounds = row.getBoundingClientRect();
      return Math.abs(portBounds.y + portBounds.height / 2 - rowBounds.y - rowBounds.height / 2);
    }));
    expect(Math.max(...offsets)).toBeLessThan(1);
    await page.getByRole("button", { name: "Toggle draw mode", exact: true }).click();
    const edge = page.locator('.flow-sdk-edge[data-source-property="output:browser_click"][data-target-property="config:tools"]');
    await edge.dispatchEvent("click");
    await page.getByRole("button", { name: "Delete edge", exact: true }).click();
    await expect(edge).toHaveCount(0);
    await expect(page.locator('.flow-sdk-edge[data-target-property="config:tools"]')).toHaveCount(22);
    await expect(tools.locator(".flow-sdk-property-port")).toHaveCount(22);
    await pick("Control examples", "Forms");
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export resolved workflow", exact: true }).click();
    const exported = JSON.parse(readFileSync((await (await pending).path())!, "utf8"));
    const agent = exported.steps.find(step => step.id === "agent_act");
    expect(agent.config.tools).not.toContain("browser_click");
    expect(agent.config.tools).toHaveLength(22);
    expect(agent.params.tools).toHaveLength(23);
    await pick("Control examples", "Viewport");
    await pick("Example node", "Root Tools");
    await page.getByRole("region", { name: "SDK control examples" }).getByRole("button", { name: "Focus node", exact: true }).click();
    await pick("Control examples", "Controls");
    await page.screenshot({ path: test.info().outputPath("tools-object.png") });
    await tools.getByRole("button", { name: "Show icon", exact: true }).click();
    await expect(tools.locator("[data-flow-icon-label]")).toHaveCount(1);
    await expect(tools.locator('[data-flow-property^="output:browser_"]')).toHaveCount(0);
    await expect(page.locator('.flow-sdk-edge[data-target-property="config:tools"]')).toHaveCount(22);
    await page.screenshot({ path: test.info().outputPath("tools-compact.png") });
    expect(errors).toEqual([]);
  });
}