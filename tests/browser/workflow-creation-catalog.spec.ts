import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { chooseToolbarOption } from "./helpers";
const coverage = JSON.parse(readFileSync(new URL("../../examples/workflow-form/coverage.json", import.meta.url), "utf8"));

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) test(`Create Node exposes the full editor catalog and edits dynamic forms at ${width}px`, async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/sdk-test/SDKExamplesPanel.tsx*", async route => {
    const response = await route.fetch(); const body = await response.text();
    const anchor = "const colors = S.useCustomColors();";
    expect(body).toContain(anchor);
    await route.fulfill({ response, body: body.replace(anchor, `${anchor} window.__catalogDraw = { context, nodeById, edgeById };`) });
  });
  await page.route("**/agent/mcp/tools", route => route.fulfill({ json: { servers: [{ name: "platform", tools: [{ name: "demo_lookup", inputSchema: { type: "object", properties: { collection: { type: "string" } }, required: ["collection"], additionalProperties: false } }] }] } }));
  await page.route("**/tenant/integrations?limit=100", route => route.fulfill({ json: { integrations: [{ name: "catalog_demo", displayName: "Catalog Demo", integrationId: "catalog-demo", definition: { endpoints: [{ name: "lookup", method: "GET", path: "/lookup", parameters: [{ name: "query", type: "string", required: true }] }] } }] } }));
  await page.route("**/events", route => route.fulfill({ json: { events: [] } }));
  await page.route("**/tenant/entities", route => route.fulfill({ json: { data: [] } }));
  await page.route("**/tenant/asset-types", route => route.fulfill({ json: { assetTypes: [] } }));
  await page.goto(process.env.SDK_TEST_URL!);
  await page.evaluate(async () => { const path = "/src/lib/api.ts"; const { api } = await import(path); api.getTenantId = () => "catalog-test-tenant"; });
  await chooseToolbarOption(page.getByRole("combobox", { name: "Example dataset", exact: true }), "Workflow State 3");
  await expect(page.locator('[data-node-id="root.step_normalize_status"]')).toHaveCount(1);
  await page.getByRole("region", { name: "SDK control examples" }).getByRole("button", { name: "Close selection tools", exact: true }).click();
  const createdIds: Record<string, string> = {};
  for (const kind of ["http", "custom", "backflow_tool", "delay"]) {
    await page.evaluate(() => {
      const { context } = (window as any).__catalogDraw;
      context.callbacks.onNodeCreateRequest({ sourceNodeId: "root.step_normalize_status", sourceProperty: "output:output", reverse: false, position: { x: 800, y: 700 } });
    });
    const picker = page.getByRole("dialog", { name: "Configure Create Node", exact: true });
    await expect(picker).toBeVisible();
    expect((await picker.locator("[data-reusable-kind]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-reusable-kind")))).sort()).toEqual([...coverage.enabledStepTypes].sort());
    const choice = picker.locator(`[data-reusable-kind="${kind}"]`);
    await expect(choice).toBeEnabled();
    await choice.click(); await expect(picker).toBeHidden();
    const created = page.locator(`.flow-sdk-node[data-node-id^="root.step_${kind}_"]`);
    await expect(created).toHaveCount(1);
    const id = (await created.getAttribute("data-node-id"))!;
    createdIds[kind] = id;
    await page.evaluate(id => { const engine = (window as any).__catalogDraw.context.engineRef.current; const box = engine.getNodeBox(id); engine.zoom(0.7); engine.pan({ x: innerWidth / 2 - box.x * 0.7, y: 300 - box.y * 0.7 }); }, id);
    await created.locator('[aria-haspopup="dialog"]').dblclick();
    const form = page.locator('dialog[open]').filter({ has: page.locator(`[data-workflow-config-kind="${kind}"]`) });
    await expect(form).toBeVisible();
    if (kind === "http") {
      await expect(form.getByText("URL", { exact: true }).first()).toBeVisible();
      await form.locator('input[placeholder="https://api.example.com/endpoint"]').fill("https://example.invalid/items");
      await expect(form.locator("select").first()).toHaveValue("GET");
    }
    if (kind === "custom") {
      await form.locator("select").first().selectOption("catalog_demo");
      await form.locator("select").nth(1).selectOption("lookup");
      await form.locator('input[placeholder="query"]').fill("orders");
      await expect(form.locator('input[placeholder="query"]')).toHaveValue("orders");
    }
    if (kind === "backflow_tool") {
      await form.getByRole("combobox", { name: "Tool", exact: true }).selectOption("demo_lookup");
      await expect(form.getByRole("alert")).toContainText("collection");
      await form.getByRole("textbox", { name: "Tool input JSON", exact: true }).fill('{"collection":"orders"}');
      await expect(form.getByRole("alert")).toHaveCount(0);
      await expect(form.locator("summary")).toHaveText("Input schema");
    }
    if (kind === "delay") await form.locator('input[type="number"]').fill("3");
    await page.screenshot({ path: `/tmp/squeed-catalog-${kind}-${width}.png` });
    await form.getByRole("button", { name: "Close node configuration", exact: true }).click();
  }
  await chooseToolbarOption(page.getByRole("combobox", { name: "Control examples", exact: true }), "Forms");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export resolved workflow", exact: true }).click();
  const workflow = JSON.parse(readFileSync((await (await download).path())!, "utf8"));
  const step = (kind: string) => workflow.steps.find((step: any) => `root.step_${step.id}` === createdIds[kind]);
  expect(step("http").config).toMatchObject({ method: "GET", url: "https://example.invalid/items" });
  expect(step("custom").config).toMatchObject({ integration: "catalog_demo", endpoint: "lookup", parameters: { query: "orders" } });
  expect(step("backflow_tool").config).toMatchObject({ name: "demo_lookup", params: { collection: "orders" } });
  expect(step("delay").config.seconds).toBe(3);
  expect(workflow.steps).toHaveLength(20);
  expect(errors).toEqual([]);
});