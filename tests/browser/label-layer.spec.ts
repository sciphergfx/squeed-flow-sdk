import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  for (const colorMode of ["light", "dark"] as const) {
    test(`edge labels mask crossing paths in ${colorMode} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page);
      await page.evaluate(colorMode => window.__flowTest.configure({ colorMode }), colorMode);
      const label = page.locator('.flow-sdk-labels .flow-sdk-edge-label[data-edge-id="alpha-beta"]');
      await expect(label).toBeVisible();
      const point = await label.evaluate(element => {
        const layer = element.parentElement!;
        if (layer !== layer.parentElement!.lastElementChild) throw new Error("Labels must paint last");
        const mask = element.querySelector("rect")!;
        const bounds = mask.getBBox();
        const localPoint = new DOMPoint(bounds.x + 4, bounds.y + bounds.height / 2);
        const client = localPoint.matrixTransform(mask.getScreenCTM()!);
        const crossing = document.querySelector<SVGPathElement>('.flow-sdk-edge[data-edge-id="beta-gamma"] path')!;
        const model = client.matrixTransform(crossing.getScreenCTM()!.inverse());
        crossing.setAttribute("d", `M${model.x - 100} ${model.y} L${model.x + 100} ${model.y}`);
        crossing.setAttribute("stroke", "#ff0000");
        crossing.setAttribute("stroke-width", "20");
        return { x: client.x, y: client.y, fill: getComputedStyle(mask).fill };
      });
      expect(point.fill).not.toBe("none");
      expect(point.fill).not.toBe("rgba(0, 0, 0, 0)");
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".flow-sdk-edge-label")?.getAttribute("data-edge-id"), point)).toBe("alpha-beta");
      await label.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const center = window.__flowTest.engine!.clientToModel(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        const node = document.querySelector<HTMLElement>('.flow-sdk-node[data-node-id="alpha"]')!;
        node.style.transform = `translate(-50%, -50%) translate3d(${center.x}px, ${center.y}px, 0)`;
      });
      const labelBounds = await label.boundingBox();
      const nodeBounds = await page.locator('.flow-sdk-node[data-node-id="alpha"]').boundingBox();
      expect(nodeBounds!.x).toBeLessThan(labelBounds!.x + labelBounds!.width / 2);
      expect(nodeBounds!.x + nodeBounds!.width).toBeGreaterThan(labelBounds!.x + labelBounds!.width / 2);
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".flow-sdk-edge-label")?.getAttribute("data-edge-id"), point)).toBe("alpha-beta");
      await page.evaluate(() => {
        const engine = window.__flowTest.engine!;
        const pan = engine.pan();
        engine.pan({ x: pan.x + 5, y: pan.y + 5 });
        engine.zoom(engine.zoom() * 1.05);
      });
      await expect.poll(() => page.evaluate(() => document.querySelector('.flow-sdk-label-overlay > g')!.getAttribute("transform") === document.querySelector('.flow-sdk-svg:not(.flow-sdk-label-overlay) > g')!.getAttribute("transform"))).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("label-layer.png") });
      await label.click();
      await expect(page.getByRole("textbox", { name: "Edge label", exact: true })).toHaveValue("First");
      expect(await page.evaluate(() => window.__flowTest.events.filter(event => event.name === "select-edge").at(-1)?.value)).toBe("alpha-beta");
    });
  }
}