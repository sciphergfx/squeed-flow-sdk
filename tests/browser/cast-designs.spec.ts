import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const workflow = JSON.parse(readFileSync("examples/workflow-state-2/workflow.json", "utf8"));
const designs = [
  { id: "minimal", label: "Minimal", fields: 1, templates: false },
  { id: "groups", label: "Step Groups", fields: 2, templates: false },
  { id: "tools", label: "Reusable Tools", fields: 3, templates: false },
  { id: "data", label: "Data Inspection", fields: 2, templates: true },
  { id: "full", label: "Full Bindings", fields: 3, templates: true },
];
test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

async function settle(page: Page) {
  let previous = "", stableSince = Date.now();
  await expect.poll(async () => {
    const current = JSON.stringify(await page.locator(".flow-sdk-node, .flow-sdk-nodes").evaluateAll(elements => elements.map(element => [element.getAttribute("style"), element.getBoundingClientRect().width, element.getBoundingClientRect().height])));
    if (current !== previous) { previous = current; stableSince = Date.now(); }
    return Date.now() - stableSince;
  }).toBeGreaterThan(650);
}

for (const width of [1440, 390]) {
  test(`five graph designs preserve independent mappings and API exports at ${width}px`, async ({ page }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const pick = async (name: string, value: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page.getByRole("listbox", { name, exact: true }).getByRole("option", { name: value, exact: true }).click();
    };
    const download = async (name: string) => {
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name, exact: true }).click();
      return JSON.parse(readFileSync((await (await pending).path())!, "utf8"));
    };
    await pick("Example dataset", "Workflow State 2");
    const mappings = new Set<string>();
    for (const design of designs) {
      await pick("Graph design", design.label);
      await expect(page.locator(`[data-mapping-id="workflow-state-2:${design.id}"]`)).toBeVisible();
      await expect(page.locator('.flow-sdk-edge[data-target-property="config:tools"]')).toHaveCount(23);
      await expect(page.locator('.flow-sdk-node[data-node-id^="root.tool_"]')).toHaveCount(design.id === "tools" ? 23 : 0);
      if (design.templates) await expect(page.locator('.flow-sdk-node[data-node-id="root.template_input"]')).toHaveCount(1);
      else await expect(page.locator('.flow-sdk-node[data-node-id^="root.template_"]')).toHaveCount(0);
      if (design.id === "groups") await expect(page.locator('.flow-sdk-container[data-node-id="root.browser"]')).toHaveCount(1);
      if (design.id === "tools") await expect(page.locator('.flow-sdk-container[data-node-id="root.tools"]')).toHaveCount(1);
      const mapping = await download("Export resource mapping");
      expect(mapping.fields).toHaveLength(design.fields);
      expect(mapping.templates ?? false).toBe(design.templates);
      mappings.add(JSON.stringify(mapping));
      expect(await download("Export resolved workflow")).toEqual(workflow);
      await settle(page);
      await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
      await page.screenshot({ path: test.info().outputPath(`${design.id}-graph.png`) });
      await pick("Workflow step", "Agent Act");
      await pick("Control examples", "Controls");
      const agent = page.locator('.flow-sdk-node[data-node-id="root.step_agent_act"]');
      await expect(agent.locator("[data-flow-content]")).toContainText("Drive the browser session.");
      await agent.getByRole("button", { name: "Show properties", exact: true }).click();
      await expect(agent.locator('[data-flow-inspection-row][data-flow-property="config:tools"]')).toHaveCount(1);
      await expect(agent.locator("[data-flow-config-summary]")).toHaveCount(0);
      await expect(page.locator('.flow-sdk-edge[data-target-property="config:tools"]')).toHaveCount(23);
      await agent.getByRole("button", { name: "Show content", exact: true }).click();
      await expect(agent.locator("[data-flow-content]")).toBeVisible();
      await settle(page);
      await pick("Control examples", "Forms");
      await pick("Workflow step", "Find");
      const find = page.locator('.flow-sdk-node[data-node-id="root.step_find"]');
      await find.getByText("find", { exact: true }).first().dblclick();
      const form = page.getByRole("dialog", { name: "Configure find", exact: true });
      await form.getByRole("textbox", { name: "Collection", exact: true }).fill(`sessions_${design.id}`);
      await form.getByRole("textbox", { name: "Collection", exact: true }).press("Tab");
      await page.keyboard.press("Escape");
      const expected = structuredClone(workflow);
      expected.steps[0].config.collection = `sessions_${design.id}`;
      expect(await download("Export resolved workflow")).toEqual(expected);
    }
    expect(mappings.size).toBe(5);
    for (const design of designs) {
      await pick("Graph design", design.label);
      await expect(page.locator(`[data-mapping-id="workflow-state-2:${design.id}"]`)).toBeVisible();
      const expected = structuredClone(workflow);
      expected.steps[0].config.collection = `sessions_${design.id}`;
      expect(await download("Export resolved workflow")).toEqual(expected);
    }
    expect(errors).toEqual([]);
  });
}