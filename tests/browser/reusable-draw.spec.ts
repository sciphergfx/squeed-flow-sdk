import { expect, test, type Page } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

async function dragToSpace(page: Page, nodeId: string, portName: string) {
  await page.evaluate(id => {
    const { context } = (window as any).__reusableDrawTest;
    context.setIsEdgeHandlesEnabled(true);
    const engine = context.engineRef.current;
    const box = engine.getNodeBox(id);
    engine.zoom(0.22);
    engine.pan({ x: 90 - box.x * 0.22, y: 330 - box.y * 0.22 });
  }, nodeId);
  const source = page.locator(`[data-node-id="${nodeId}"]`).getByRole("button", { name: portName, exact: true });
  const bounds = (await source.boundingBox())!;
  const drop = await page.evaluate(() => {
    const occupied = [...document.querySelectorAll(".flow-sdk-node, [aria-label='SDK control examples']")].map(node => node.getBoundingClientRect());
    for (const y of [650, 550, 750, 450]) for (const x of [innerWidth - 40, innerWidth / 2, 40]) {
      if (occupied.every(rect => x < rect.left - 20 || x > rect.right + 20 || y < rect.top - 20 || y > rect.bottom + 20)) {
        return { x, y, model: (window as any).__reusableDrawTest.context.engineRef.current.clientToModel(x, y) };
      }
    }
    throw new Error("No empty drop point.");
  });
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(drop.x, drop.y, { steps: 12 });
  await page.mouse.up();
  return drop;
}

for (const width of [1440, 390]) test(`property draw opens reusable modal and honors the connection at ${width}px`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/sdk-test/SDKExamplesPanel.tsx*", async route => {
    const response = await route.fetch();
    const body = await response.text();
    const anchor = "const colors = S.useCustomColors();";
    expect(body).toContain(anchor);
    await route.fulfill({ response, body: body.replace(anchor, `${anchor} window.__reusableDrawTest = { context, nodeById, edgeById };`) });
  });
  await page.goto(process.env.SDK_TEST_URL!);
  await chooseToolbarOption(page.getByRole("combobox", { name: "Example dataset", exact: true }), "Workflow State 3");
  await expect(page.locator('.flow-sdk-node[data-node-id^="root.step_"]')).toHaveCount(16, { timeout: 15000 });
  await page.getByRole("region", { name: "SDK control examples" }).getByRole("button", { name: "Close selection tools", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__reusableDrawTest.context.engineRef.current?.getNodeBox("root.step_normalize_status")?.w)).toBeGreaterThan(0);
  const before = await page.evaluate(() => ({ nodes: [...(window as any).__reusableDrawTest.nodeById.keys()], edges: [...(window as any).__reusableDrawTest.edgeById.keys()] }));
  await dragToSpace(page, "root.step_normalize_status", "Connect output:output");
  const dialog = page.getByRole("dialog", { name: "Configure Create Node", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("strong")).toHaveText("Create Node");
  const filter = dialog.getByRole("searchbox", { name: "Filter reusable nodes", exact: true });
  await expect(filter).toBeFocused();
  await expect(filter).toHaveAttribute("placeholder", "Search nodes...");
  await expect(filter).toHaveCSS("border-radius", "5px");
  const inputBounds = (await filter.boundingBox())!;
  const iconBounds = (await dialog.locator("[data-form-filter] svg").boundingBox())!;
  expect(iconBounds.x).toBeGreaterThan(inputBounds.x);
  expect(iconBounds.x + iconBounds.width).toBeLessThan(inputBounds.x + inputBounds.width);
  expect(iconBounds.y).toBeGreaterThan(inputBounds.y);
  expect(iconBounds.y + iconBounds.height).toBeLessThan(inputBounds.y + inputBounds.height);
  const height = (await dialog.boundingBox())!.height;
  await expect(dialog.locator("[data-form-scroll]")).toHaveCSS("overflow-y", "auto");
  expect(await dialog.locator("[data-form-scroll]").evaluate(element => getComputedStyle(element).maskImage)).toContain("linear-gradient");
  expect(await dialog.locator("[data-form-scroll]").evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.screenshot({ path: `/tmp/squeed-reusable-picker-${width}.png` });
  await filter.fill("not-a-template");
  await expect(dialog.getByRole("status")).toHaveText("No matching reusable nodes.");
  expect((await dialog.boundingBox())!.height).toBeCloseTo(height, 0);
  await filter.fill("Database");
  await expect(dialog.getByRole("button", { name: "Insert Database", exact: true })).toBeEnabled();
  await expect(dialog.locator('[data-reusable-icon="PiDatabase"]')).not.toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => [...(window as any).__reusableDrawTest.nodeById.keys()])).toEqual(before.nodes);
  expect(await page.evaluate(() => [...(window as any).__reusableDrawTest.edgeById.keys()])).toEqual(before.edges);
  const drop = await dragToSpace(page, "root.step_normalize_status", "Connect output:output");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Filter reusable nodes" }).fill("Database");
  await dialog.getByRole("button", { name: "Insert Database", exact: true }).click();
  await expect(dialog).toBeHidden();
  const created = page.locator('.flow-sdk-node[data-node-id^="root.step_database_"]');
  await expect(created).toHaveCount(1);
  const id = (await created.getAttribute("data-node-id"))!;
  await expect.poll(() => page.evaluate(({ id, position }) => {
    const box = (window as any).__reusableDrawTest.context.engineRef.current.getNodeBox(id);
    return box ? Math.hypot(box.x - position.x, box.y - position.y) : Infinity;
  }, { id, position: drop.model })).toBeLessThan(1);
  const connection = await page.evaluate(id => [...(window as any).__reusableDrawTest.edgeById.values()].map((edge: any) => edge.data).find((edge: any) => edge.target === id && edge.source === "root.step_normalize_status"), id);
  expect(connection).toMatchObject({ source: "root.step_normalize_status", sourceProperty: "output:output", targetProperty: "input:input" });
  await page.screenshot({ path: `/tmp/squeed-reusable-draw-${width}.png` });
  const modelDrop = await dragToSpace(page, "root.step_agent_act", "Input config:model");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Filter reusable nodes" }).fill("model:");
  const modelChoice = dialog.getByRole("button", { name: "Insert model: step_agent_act", exact: true });
  await expect(modelChoice).toBeEnabled();
  await modelChoice.click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => [...(window as any).__reusableDrawTest.edgeById.values()].filter((edge: any) => edge.data.target === "root.step_agent_act" && edge.data.targetProperty === "config:model").length)).toBe(1);
  const modelEdges = await page.evaluate(() => [...(window as any).__reusableDrawTest.edgeById.values()].map((edge: any) => edge.data).filter((edge: any) => edge.target === "root.step_agent_act" && edge.targetProperty === "config:model"));
  await expect.poll(() => page.evaluate(({ id, position }) => {
    const box = (window as any).__reusableDrawTest.context.engineRef.current.getNodeBox(id);
    return box ? Math.hypot(box.x - position.x, box.y - position.y) : Infinity;
  }, { id: modelEdges[0].source, position: modelDrop.model })).toBeLessThan(1);
  expect(await page.evaluate(() => [...(window as any).__reusableDrawTest.edgeById.values()].map((edge: any) => edge.data).filter((edge: any) => edge.target === "root.step_agent_act" && edge.targetProperty === "config:model"))).toHaveLength(1);
  expect(errors).toEqual([]);
});