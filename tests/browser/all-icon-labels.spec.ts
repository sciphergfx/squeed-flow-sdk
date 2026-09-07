import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("all icon labels closes an expanded grouped Tools registry", async ({ page }) => {
  await ready(page, "graph=basic-json");
  await page.evaluate(() => {
    window.__flowTest.configure({
      selectionToolbar: false,
      formSchema: {
        Registry: {
          kind: "object",
          properties: {
            tools: {
              optional: false,
              type: {
                kind: "object",
                properties: {},
                additionalProperties: { kind: "object", properties: { name: { type: { kind: "string" }, optional: false } } },
              },
            },
          },
        },
      },
    });
    window.__flowTest.replaceDocument({
      $hideRoot: true,
      tools: {
        $label: "Tools",
        $view: "icon-label",
        $icon: "PiWrench",
        $connections: [
          { target: "root.consumer", sourceProperty: "output:lookup", targetProperty: "tools" },
          { target: "root.consumer", sourceProperty: "output:search", targetProperty: "tools" },
        ],
      },
      consumer: { $label: "Consumer", $view: "object", tools: "Configured" },
    });
    window.__flowTest.replaceForms({
      structured: true,
      state: { tools: { lookup: { name: "Lookup resource" }, search: { name: "Search resource" } } },
      bindings: {
        "root.tools": {
          address: "root",
          type: "Registry",
          portResources: { "output:lookup": "root.tools.lookup", "output:search": "root.tools.search" },
        },
      },
    });
  });
  const tools = page.locator('.flow-sdk-node[data-node-id="root.tools"]');
  await expect(tools.getByText("Tools", { exact: true })).toBeVisible();
  await tools.getByText("Tools", { exact: true }).click();
  await tools.getByRole("button", { name: "Show properties", exact: true }).click();
  await expect(tools.getByText("Lookup resource", { exact: true })).toBeVisible();
  const toolbar = page.getByRole("toolbar", { name: "Diagram controls", exact: true });
  await toolbar.getByRole("button", { name: "Toggle toolbar collapse", exact: true }).click();
  const toggle = toolbar.getByRole("button", { name: "All icon labels", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(tools.getByText("Lookup resource", { exact: true })).toHaveCount(0);
  await expect(tools.getByText("Search resource", { exact: true })).toHaveCount(0);
  await expect(tools.getByText("Tools", { exact: true })).toBeVisible();
  await expect(page.locator(".flow-sdk-node")).toHaveCount(2);
  await expect(page.locator('[data-node-id^="root.__form_"]')).toHaveCount(0);
  await tools.getByText("Tools", { exact: true }).click();
  await tools.getByRole("button", { name: "Show properties", exact: true }).click();
  await expect(tools.getByText("Lookup resource", { exact: true })).toBeVisible();
  await expect(tools.getByText("Search resource", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__flowTest.document.tools.$connections.map((edge) => edge.sourceProperty)))
    .toEqual(["output:lookup", "output:search"]);
});

for (const width of [1440, 390]) {
  test(`all icon labels compacts structured nodes and restores details at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "graph=basic-json");
    const document = { $hideRoot: true, sample: { $label: "Sample", $view: "object" } };
    await page.evaluate((next) => {
      window.__flowTest.replaceDocument(next);
      window.__flowTest.configure({
        formSchema: {
          Sample: {
            kind: "object",
            properties: {
              name: { type: { kind: "string" }, optional: false },
              options: { type: { kind: "object", properties: { region: { type: { kind: "string" }, optional: false } } }, optional: false },
              tags: { type: { kind: "array", items: { kind: "string" } }, optional: false },
            },
          },
        },
      });
      window.__flowTest.replaceForms({
        structured: true,
        state: { sample: { name: "Sample", options: { region: "West" }, tags: ["urgent", "queued"] } },
        bindings: { "root.sample": { address: "root.sample", type: "Sample" } },
      });
    }, document);
    const details = page.getByText("West", { exact: true });
    await expect(details).toBeVisible();
    const nodeCount = await page.locator(".flow-sdk-node").count();
    expect(nodeCount).toBeGreaterThan(1);
    const toolbar = page.getByRole("toolbar", { name: "Diagram controls", exact: true });
    await toolbar.getByRole("button", { name: "Toggle toolbar collapse", exact: true }).click();
    const toggle = toolbar.getByRole("button", { name: "All icon labels", exact: true });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeInViewport();
    const labels = await toolbar.getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(labels[labels.indexOf("Compact layout") + 1]).toBe("All icon labels");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(details).toHaveCount(0);
    await expect(page.locator("[data-flow-inspection-row]")).toHaveCount(0);
    await expect(page.locator(".flow-sdk-node")).toHaveCount(1);
    await expect(page.locator('[data-node-id^="root.__form_"]')).toHaveCount(0);
    await toggle.screenshot({ path: test.info().outputPath("all-icon-labels-toggle.png") });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(details).toBeVisible();
    await expect(page.getByText("urgent", { exact: true })).toBeVisible();
    await expect(page.locator(".flow-sdk-node")).toHaveCount(nodeCount);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(document);
  });
}