import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const type of ["text", "arrayView"] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`${type} fits content and truncates long labels at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await ready(page);
      await page.evaluate((type) => {
        window.__flowTest.configure({ nodeAlignment: "leading" });
        window.__flowTest.replaceGraph({
          nodes: [
            { data: { id: "origin", type, label: "Start" } },
            { data: { id: "short", type, label: "Hi" } },
            { data: { id: "wide", type, label: "A longer node label" } },
            { data: { id: "long", type, label: "Unbroken".repeat(50) } },
          ],
          edges: ["short", "wide", "long"].map((target) => ({
            data: { id: `origin-${target}`, source: "origin", target },
          })),
        });
      }, type);
      await expect
        .poll(() =>
          page.evaluate(
            () => window.__flowTest.engine!.getNodeBox("long")?.w ?? 0,
          ),
        )
        .toBeGreaterThan(900);
      const measurements = await page.evaluate(() =>
        Object.fromEntries(
          ["short", "wide", "long"].map((id) => {
            const node = document.querySelector<HTMLElement>(
              `.flow-sdk-node[data-node-id="${id}"]`,
            )!;
            const label = node.querySelector("p")!;
            const style = getComputedStyle(label);
            return [
              id,
              {
                width: node.offsetWidth,
                labelHeight: label.offsetHeight,
                labelWidth: label.clientWidth,
                scrollWidth: label.scrollWidth,
                whiteSpace: style.whiteSpace,
                textOverflow: style.textOverflow,
              },
            ];
          }),
        ),
      );
      expect(measurements.short.width).toBeLessThan(measurements.wide.width);
      expect(measurements.short.width).toBeLessThan(400);
      expect(measurements.long.width).toBeLessThanOrEqual(1064);
      expect(measurements.long.labelHeight).toBe(
        measurements.short.labelHeight,
      );
      expect(measurements.long.labelWidth).toBeLessThanOrEqual(900);
      expect(measurements.long.scrollWidth).toBeGreaterThan(
        measurements.long.labelWidth,
      );
      expect(measurements.long.whiteSpace).toBe("nowrap");
      expect(measurements.long.textOverflow).toBe("ellipsis");
      await expect(
        page.locator('.flow-sdk-node[data-node-id="long"] p'),
      ).toHaveAttribute("title", "Unbroken".repeat(50));
      await expect
        .poll(() =>
          page.evaluate(() => {
            const engine = window.__flowTest.engine!;
            const edges = ["short", "wide", "long"].map((id) => {
              const node = engine.getNodeBox(id)!;
              return node.x - node.w / 2;
            });
            return Math.max(...edges) - Math.min(...edges);
          }),
        )
        .toBeLessThan(0.01);
      await expect(page.locator(".flow-sdk-edge")).toHaveCount(3);
      await page.evaluate(() => window.__flowTest.engine!.fit(50));
      await page.screenshot({
        path: testInfo.outputPath(`${type}-${viewport.width}.png`),
      });

      if (viewport.width === 1440) {
        await page.locator('.flow-sdk-node[data-node-id="short"]').click();
        const input = page.getByRole("textbox", {
          name: "Node label",
          exact: true,
        });
        await input.fill("This label is longer");
        await input.press("Enter");
        await expect
          .poll(() =>
            page.evaluate(
              () => window.__flowTest.engine!.getNodeBox("short")!.w,
            ),
          )
          .toBeGreaterThan(measurements.short.width);
        const node = page.locator('.flow-sdk-node[data-node-id="short"]');
        await expect(node).toContainText("This label is longer");
        await node.locator("p").dblclick();
        const inlineInput = node.getByRole("textbox");
        await expect(inlineInput).toHaveValue("This label is longer");
        await inlineInput.fill("Edited inline");
        await inlineInput.press("Enter");
        await expect(node.locator("p")).toHaveText("Edited inline");
        await node.locator("p").dblclick();
        await inlineInput.fill("Cancelled edit");
        await inlineInput.press("Escape");
        await expect(node.locator("p")).toHaveText("Edited inline");
      }
    });
  }
}
