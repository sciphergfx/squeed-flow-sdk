import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`SDK Test stores node Pulse and edge Trace on raw graphs at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const node = page.locator('.flow-sdk-node[data-node-id="process"]');
    await node.locator("[data-flow-node-surface]").click();
    await page.getByRole("button", { name: "Toggle node animation", exact: true }).click();
    await chooseToolbarOption(page.getByRole("combobox", { name: "Node animation", exact: true }), "Pulse");
    await expect(node.locator(".flow-sdk-node-border-pulse")).toHaveCount(1);
    const toolbar = page.getByRole("toolbar", { name: "Diagram controls", exact: true });
    await toolbar.getByRole("button", { name: "Close selection tools", exact: true }).click();
    await toolbar.getByRole("button", { name: "Reset zoom", exact: true }).click();
    await page.locator('.flow-sdk-edge-label[data-edge-id="success"]').click();
    await page.getByRole("button", { name: "Edge style animated", exact: true }).click();
    await chooseToolbarOption(page.getByRole("combobox", { name: "Edge animation", exact: true }), "Trace");
    await expect(page.locator('.flow-sdk-edge[data-edge-id="success"] .flow-sdk-edge-trace')).toHaveCount(1);
    await page.getByRole("button", { name: "View JSON", exact: true }).click();
    const graph = JSON.parse(await page.getByRole("textbox", { name: "JSON JSON", exact: true }).inputValue());
    expect(graph.nodes.find(node => node.data.id === "process").data).toMatchObject({ isNodeAnimated: true, nodeAnimationVariant: "pulse" });
    expect(graph.edges.find(edge => edge.data.id === "success").data).toMatchObject({ isEdgeAnimated: true, edgeAnimationVariant: "traveling" });
    expect(graph.edges.find(edge => edge.data.id === "review").data.edgeAnimationVariant).toBeUndefined();
    await page.getByRole("button", { name: "View JSON", exact: true }).click();
    await page.getByRole("combobox", { name: "Edge animation", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath("sdk-test-animation-variants.png") });
    expect(errors).toEqual([]);
  });
}