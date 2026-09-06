import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

test("deleting and redrawing a template link updates the selected fallback source", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(process.env.SDK_TEST_URL!);
  const pick = async (name: string, value: string) => {
    await page.getByRole("combobox", { name, exact: true }).click();
    await page.getByRole("listbox", { name, exact: true }).getByRole("option", { name: value, exact: true }).click();
  };
  const readValue = async () => {
    await page.getByRole("button", { name: "View state", exact: true }).click();
    const state = JSON.parse((await page.getByTestId("squeed-json").textContent())!);
    await page.getByRole("button", { name: "View state", exact: true }).click();
    return state.workflow.steps.find(step => step.id === "normalize_status").config.value;
  };
  await pick("Example dataset", "Workflow State 2");
  const result = page.locator('.flow-sdk-edge[data-source-property="template:result.status"][data-target-property="value"]');
  await expect(result).toHaveCount(1);
  await result.dispatchEvent("click");
  await page.getByRole("button", { name: "Delete edge", exact: true }).click();
  await expect(result).toHaveCount(0);
  expect(await readValue()).toBe("{{steps.agent_act.output.status}}");
  const agent = page.locator('.flow-sdk-node[data-node-id="root.step_agent_act"]');
  const normalize = page.locator('.flow-sdk-node[data-node-id="root.step_normalize_status"]');
  const settle = async () => {
    let previous = "", stableSince = Date.now();
    await expect.poll(async () => {
      const current = JSON.stringify(await page.locator(".flow-sdk-node, .flow-sdk-nodes").evaluateAll(elements => elements.map(element => [element.getAttribute("style"), element.getBoundingClientRect().width, element.getBoundingClientRect().height])));
      if (current !== previous) { previous = current; stableSince = Date.now(); }
      return Date.now() - stableSince;
    }).toBeGreaterThan(700);
  };
  for (const [label, node] of [["Agent Act", agent], ["Normalize Status", normalize]] as const) {
    await settle();
    await pick("Control examples", "Forms");
    await pick("Workflow step", label);
    await pick("Control examples", "Controls");
    await node.getByRole("button", { name: "Show properties", exact: true }).click();
  }
  const source = agent.getByRole("button", { name: "Connect template:result.summary", exact: true });
  const target = normalize.getByRole("button", { name: "Input value", exact: true });
  let previous = "", stableSince = Date.now();
  await expect.poll(async () => {
    const current = JSON.stringify([await source.boundingBox(), await target.boundingBox()]);
    if (current !== previous) { previous = current; stableSince = Date.now(); }
    return Date.now() - stableSince;
  }).toBeGreaterThan(600);
  await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
  await expect(source).toBeInViewport();
  await expect(target).toBeInViewport();
  const from = (await source.boundingBox())!, to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.flow-sdk-edge[data-source-property="template:result.summary"][data-target-property="value"]')).toHaveCount(1);
  expect(await readValue()).toBe("{{steps.agent_act.result.summary || steps.agent_act.output.status}}");
  expect(errors).toEqual([]);
});