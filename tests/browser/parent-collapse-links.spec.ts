import { expect, test, type Page } from "@playwright/test";
import type { FlowDiagramEdge } from "../../src/types";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

async function collapsedLinkGaps(page: Page, parentId: string, links: FlowDiagramEdge[]) {
  return page.evaluate(({ parentId, links }) => {
    const surface = document.querySelector(`.flow-sdk-node[data-node-id="${parentId}"] [data-flow-node-surface]`);
    if (!surface) return [Infinity];
    const bounds = surface.getBoundingClientRect();
    return links.map(({ data }) => {
      const edge = [...document.querySelectorAll(".flow-sdk-edge")].find(element => element.getAttribute("data-edge-id") === data.id);
      const path = edge?.querySelector("path");
      const matrix = path?.getScreenCTM();
      if (!path || !matrix || !path.getTotalLength()) return Infinity;
      const point = path.getPointAtLength(data.source === parentId ? 0 : path.getTotalLength()).matrixTransform(matrix);
      return Math.hypot(
        Math.max(bounds.left - point.x, 0, point.x - bounds.right),
        Math.max(bounds.top - point.y, 0, point.y - bounds.bottom),
      ) / Math.hypot(matrix.a, matrix.b);
    });
  }, { parentId, links });
}

for (const width of [1440, 390]) {
  for (const group of [
    { key: "templateVariables", label: "Template Variables", children: '.flow-sdk-node[data-node-id^="root.template_"]', count: 2 },
    { key: "sdkResources", label: "Reusable Configuration", children: '.flow-sdk-node[data-node-id^="root.resource_"]', count: 5 },
  ]) {
    test(`${group.label} stays linked while collapsed at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize({ width, height: 950 });
      await page.route("**/sdk-test/SDKExamplesPanel.tsx*", async route => {
        const response = await route.fetch();
        const body = await response.text();
        const anchor = "const colors = S.useCustomColors();";
        expect(body).toContain(anchor);
        await route.fulfill({ response, body: body.replace(anchor, `${anchor} window.__parentGraph = { nodeById, edgeById };`) });
      });
      await page.goto(process.env.SDK_TEST_URL!);
      await chooseToolbarOption(page.getByRole("combobox", { name: "Example dataset", exact: true }), "Workflow State 2");
      await expect(page.locator('.flow-sdk-node[data-node-id="root.template_execution"]')).toHaveCount(1);
      await page.getByRole("button", { name: "Close selection tools", exact: true }).click();
      const parentId = `root.${group.key}`;
      const container = page.locator(`.flow-sdk-container[data-node-id="${parentId}"]`);
      const label = page.locator(`.flow-sdk-container-label[data-node-id="${parentId}"]`);
      const compact = page.locator(`.flow-sdk-node[data-node-id="${parentId}"]`);
      const children = page.locator(group.children);
      await expect(children).toHaveCount(group.count);
      await container.screenshot();
      await expect(page.locator(".flow-sdk-canvas")).toHaveAttribute("data-edge-mode", "properties");
      const childIds = await children.evaluateAll(elements => elements.map(element => element.getAttribute("data-node-id")!));
      const external: FlowDiagramEdge[] = await page.evaluate(childIds => {
        const { edgeById } = (window as any).__parentGraph;
        return [...edgeById.values()].filter((edge: any) =>
          (edge.data.sourceProperty !== undefined || edge.data.targetProperty !== undefined) &&
          childIds.includes(edge.data.source) !== childIds.includes(edge.data.target));
      }, childIds);
      expect(external.length).toBeGreaterThan(0);
      const edgeIds = () => page.locator(".flow-sdk-edge").evaluateAll(elements => elements.map(element => element.getAttribute("data-edge-id")).sort());
      const originalIds = await edgeIds();
      for (const { data } of external) expect(originalIds).toContain(data.id);
      await label.locator("text").click();
      await label.getByRole("button", { name: "Show icon", exact: true }).click();
      await expect(container).toHaveCount(0);
      await expect(children).toHaveCount(0);
      await expect(compact.locator("[data-flow-icon-label]")).toHaveCount(1);
      const projected = external.map(edge => ({ ...edge, data: {
        ...edge.data,
        source: childIds.includes(edge.data.source) ? parentId : edge.data.source,
        target: childIds.includes(edge.data.target) ? parentId : edge.data.target,
        collapsedEndpoints: { source: edge.data.source, target: edge.data.target },
      } }));
      const currentLinks = () => page.evaluate(external => external.map(({ data }) => (window as any).__parentGraph.edgeById.get(data.id)), external);
      await expect.poll(currentLinks).toEqual(projected);
      await expect.poll(async () => Math.max(...await collapsedLinkGaps(page, parentId, projected))).toBeLessThanOrEqual(82);
      await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
      await compact.locator("[data-flow-node-surface]").click();
      await page.screenshot({ path: test.info().outputPath("collapsed-connected.png") });
      await compact.getByRole("button", { name: "Show parent", exact: true }).click();
      await expect(container).toHaveCount(1);
      await expect(children).toHaveCount(group.count);
      await expect.poll(currentLinks).toEqual(external);
      await expect.poll(edgeIds).toEqual(originalIds);
      expect(errors).toEqual([]);
    });
  }
}