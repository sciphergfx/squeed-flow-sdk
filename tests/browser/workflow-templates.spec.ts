import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

async function choose(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Example dataset", exact: true }).click();
  await page.getByRole("listbox", { name: "Example dataset", exact: true }).getByRole("option", { name, exact: true }).click();
}

for (const width of [1440, 390]) test(`template directory and icon workflows at ${width}px`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(process.env.SDK_TEST_URL!);
  const trigger = page.getByRole("combobox", { name: "Example dataset", exact: true });
  await expect(trigger).toHaveAttribute("title", "Templates");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Example dataset", exact: true });
  await expect(dialog.locator("summary")).toHaveText("Templates");
  await expect(dialog.getByRole("option")).toHaveCount(15);
  await dialog.locator("summary").click();
  await expect(dialog.getByRole("listbox")).toBeHidden();
  await dialog.locator("summary").click();
  await dialog.getByRole("option", { name: "Workflow State 3", exact: true }).click();
  await expect(dialog).toBeHidden();
  const steps = page.locator('.flow-sdk-node[data-node-id^="root.step_"]');
  await expect(steps).toHaveCount(16);
  await expect(steps.locator("[data-flow-icon-label]")).toHaveCount(16);
  await expect(page.locator("[data-flow-inspection-row]")).toHaveCount(0);
  await expect(page.locator('.flow-sdk-node[data-node-id="root.sdkResources"]')).toHaveCount(1);
  const controls = page.getByRole("group", { name: "Diagram configuration", exact: true });
  await controls.getByRole("tab", { name: "Files", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export diagram package", exact: true }).click();
  const saved = JSON.parse(readFileSync((await (await download).path())!, "utf8"));
  expect(saved.source.workflow).toEqual(JSON.parse(readFileSync("examples/workflow-state-2/workflow.json", "utf8")));
  expect(saved.design.canvas.edgeMode).toBe("properties");
  await page.getByRole("combobox", { name: "Workflow step", exact: true }).click();
  await page.getByRole("listbox", { name: "Workflow step", exact: true }).getByRole("option", { name: "Agent Act", exact: true }).click();
  await page.getByRole("region", { name: "SDK control examples" }).getByRole("button", { name: "Close selection tools", exact: true }).click();
  const agent = page.locator('[data-node-id="root.step_agent_act"]');
  await agent.locator("[data-flow-icon-label]").click();
  await agent.getByRole("button", { name: "Show properties", exact: true }).click();
  const prompt = agent.locator('[data-flow-inspection-row][data-flow-property="config:prompt"]');
  await expect(prompt).not.toContainText("resource_%");
  await expect(prompt).toContainText(saved.source.workflow.steps.find(step => step.id === "agent_act").config.prompt.slice(0, 80));
  await expect(agent.locator('[data-flow-inspection-row][data-flow-property="config:model"]')).not.toContainText("resource_%");
  await expect(agent.locator('[data-flow-property="input:input"] p')).toHaveCSS("text-align", "left");
  await expect(agent.locator('[data-flow-property="output:output"] p')).toHaveCSS("text-align", "right");
  await agent.getByRole("button", { name: "Show icon", exact: true }).click();
  await page.screenshot({ path: `/tmp/squeed-workflow-state-3-${width}.png` });
  await choose(page, "Workflow State 2");
  await expect(page.locator('[data-node-id="root.step_agent_act"] [data-flow-icon-label]')).toHaveCount(0);
  await choose(page, "Conditional Workflow");
  for (const id of ["trigger", "step_check", "step_run", "step_skip"]) {
    await expect(page.locator(`[data-node-id="root.${id}"] [data-flow-icon-label]`)).toHaveCount(1);
  }
  await expect(page.locator('.flow-sdk-edge[data-edge-id*="depends:step_check:"]')).toHaveCount(2);
  await expect(page.locator('.flow-sdk-edge[data-edge-id*="depends:step_check:run"]')).toHaveCount(1);
  await expect(page.locator('.flow-sdk-edge[data-edge-id*="depends:step_check:skip"]')).toHaveCount(1);
  await page.getByRole("region", { name: "SDK control examples" }).getByRole("button", { name: "Close selection tools", exact: true }).click();
  await page.screenshot({ path: `/tmp/squeed-conditional-workflow-${width}.png` });
  expect(errors).toEqual([]);
});