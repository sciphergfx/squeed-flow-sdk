import { expect, test } from "@playwright/test";
import { clearEvents, ready } from "./helpers";

for (const graph of ["raw", "json"]) {
  test(`${graph} custom nodes share selection and editing`, async ({ page }) => {
    await ready(page, `?graph=${graph}&custom=editable`);
    const nodeId = graph === "json" ? "root.alpha" : "alpha";
    const node = page.locator(`.flow-sdk-node[data-node-id="${nodeId}"]`);
    await node.locator("p").click();
    await expect(node.locator("[data-custom-selected]")).toHaveAttribute("data-custom-selected", "true");
    const toolbar = page.getByRole("textbox", { name: "Node label", exact: true });
    await toolbar.fill("Toolbar rename");
    await toolbar.press("Enter");
    await expect(node.locator("p")).toHaveText("Toolbar rename");
    await node.locator("p").dblclick();
    await clearEvents(page);
    await node.getByRole("textbox").fill("Inline rename");
    await node.getByRole("textbox").press("Enter");
    await expect(toolbar).toHaveValue("Inline rename");
    expect(await page.evaluate(() => window.__flowTest.events.filter(event => event.name === "label"))).toHaveLength(1);
    await node.locator("p").dblclick();
    await node.getByRole("textbox").fill("Cancelled");
    await node.getByRole("textbox").press("Escape");
    await expect(node.locator("p")).toHaveText("Inline rename");
    if (graph === "json") {
      await page.getByRole("button", { name: "Background red.500", exact: true }).click();
      await expect(node.locator("ellipse")).toHaveAttribute("fill", "#ef4444");
      expect(await page.evaluate(() => window.__flowTest.document.alpha.$label)).toBe("Inline rename");
    }
    await page.evaluate(() => window.__flowTest.configure({ isMultiSelectMode: true }));
    await page.locator(`.flow-sdk-node[data-node-id="${graph === "json" ? "root.beta" : "beta"}"] p`).click();
    await expect(page.locator('[data-custom-selected="true"]')).toHaveCount(2);
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await node.locator("p").dblclick();
    await expect(node.getByRole("textbox")).toHaveCount(0);
    await page.evaluate(() => window.__flowTest.configure({ readOnly: false, isMultiSelectMode: false }));
    await node.locator("p").click();
    await page.getByRole("button", { name: "Delete selected nodes", exact: true }).click();
    await expect(node).toHaveCount(0);
  });
}