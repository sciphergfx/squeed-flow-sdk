import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  for (const direction of ["LR", "RL", "TB", "BT"] as const) {
    test(`${direction} branch labels avoid sibling paths at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await ready(page, "?custom=1");
      await page.evaluate((direction) => {
        const targets = ["branch-one", "branch-two", "branch-three", "branch-four"];
        window.__flowTest.configure({ direction, nodeAlignment: "leading" });
        window.__flowTest.replaceGraph({
          nodes: ["alpha", ...targets].map((id) => ({
            data: { id, type: "text", label: id, viewProps: { width: 320, height: 240 } },
          })),
          edges: targets.map((target) => ({
            data: { id: target, source: "alpha", target, label: "drawn", isEdgeAnimated: true },
          })),
        });
      }, direction);
      await expect(page.locator('.flow-sdk-node[style*="hidden"]')).toHaveCount(0);
      await expect(page.locator(".flow-sdk-edge-label")).toHaveCount(4);
      await expect(page.locator('.flow-sdk-node[data-node-id="branch-four"]')).toBeVisible();
      await page.locator('.flow-sdk-node[data-node-id="branch-four"]').screenshot();
      await page.evaluate(() => window.__flowTest.engine!.fit(80));
      const collisions = await page.evaluate(() => {
        const edges = [...document.querySelectorAll<SVGGElement>(".flow-sdk-edge")];
        const collisions: string[] = [];
        for (const edge of edges) {
          const label = document.querySelector(`.flow-sdk-edge-label[data-edge-id="${CSS.escape(edge.dataset.edgeId!)}"] rect`)!.getBoundingClientRect();
          for (const other of edges) {
            if (other === edge) continue;
            const otherLabel = document.querySelector(`.flow-sdk-edge-label[data-edge-id="${CSS.escape(other.dataset.edgeId!)}"] rect`)!.getBoundingClientRect();
            if (label.left < otherLabel.right && label.right > otherLabel.left && label.top < otherLabel.bottom && label.bottom > otherLabel.top)
              collisions.push(`labels: ${edge.dataset.edgeId}, ${other.dataset.edgeId}`);
            const path = other.querySelector("path")!;
            const length = path.getTotalLength();
            for (let distance = 0; distance <= length; distance += 2) {
              const point = path.getPointAtLength(distance).matrixTransform(path.getScreenCTM()!);
              if (point.x > label.left && point.x < label.right && point.y > label.top && point.y < label.bottom) {
                collisions.push(`path: ${other.dataset.edgeId} covers label ${edge.dataset.edgeId}`);
                break;
              }
            }
          }
        }
        return collisions;
      });
      expect(collisions).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("branches.png") });
      const label = page.locator('.flow-sdk-edge-label[data-edge-id="branch-two"]');
      const bounds = await label.boundingBox();
      await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      await expect(page.getByRole("textbox", { name: "Edge label", exact: true })).toHaveValue("drawn");
      await expect(page.locator(".flow-sdk-edge-anim")).toHaveCount(4);
    });
  }
}