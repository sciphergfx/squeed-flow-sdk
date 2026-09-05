import { expect, test } from "@playwright/test";
import { clearEvents, ready } from "./helpers";

test("object titles edit inline and persist to JSON without changing mappings", async ({ page }) => {
  await ready(page, "?graph=connections");
  const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
  const original = await page.evaluate(() => window.__flowTest.document.alpha);
  await node.locator("p").first().dblclick();
  const input = node.getByRole("textbox");
  await expect(input).toBeFocused();
  await clearEvents(page);
  await input.fill("Backend API");
  await input.press("Enter");
  await expect(node.locator("p").first()).toHaveText("Backend API");
  expect(await page.evaluate(() => window.__flowTest.document.alpha)).toEqual({ ...original, $label: "Backend API" });
  expect(await page.evaluate(() => window.__flowTest.events.filter((event) => event.name === "json"))).toHaveLength(1);
  await node.locator("p").first().dblclick();
  await input.fill("Cancelled title");
  await input.press("Escape");
  await expect(node.locator("p").first()).toHaveText("Backend API");
  expect(await page.evaluate(() => window.__flowTest.document.alpha.$label)).toBe("Backend API");
});

test("raw object titles display updated labels after inline and toolbar edits", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.__flowTest.replaceGraph({
    nodes: [
      { data: { id: "alpha", type: "objectView", headerTitle: "Service", description: { runtime: "Node" } } },
      { data: { id: "beta", type: "text", label: "Target" } },
    ],
    edges: [{ data: { id: "alpha-beta", source: "alpha", target: "beta" } }],
  }));
  const node = page.locator('.flow-sdk-node[data-node-id="alpha"]');
  await node.locator("p").first().dblclick();
  const input = node.getByRole("textbox");
  await input.fill("Renamed service");
  await input.press("Enter");
  await expect(node.locator("p").first()).toHaveText("Renamed service");
  const toolbarInput = page.getByRole("textbox", { name: "Node label", exact: true });
  await toolbarInput.fill("Edited in toolbar");
  await toolbarInput.press("Enter");
  await expect(node.locator("p").first()).toHaveText("Edited in toolbar");
  await expect(node.locator('[data-flow-property="runtime"]')).toContainText("Node");
});

test("read-only object titles cannot enter inline editing", async ({ page }) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
  const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
  await clearEvents(page);
  await node.locator("p").first().dblclick();
  await expect(node.getByRole("textbox")).toHaveCount(0);
  expect(await page.evaluate(() => window.__flowTest.events.filter((event) => event.name === "label" || event.name === "json"))).toEqual([]);
});