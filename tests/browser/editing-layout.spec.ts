import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const type of ["text", "arrayView", "objectView"] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`${type} starts at its current size and grows while editing at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await ready(page);
      await page.evaluate(
        (type) =>
          window.__flowTest.replaceGraph({
            nodes: [
              {
                data: {
                  id: "alpha",
                  type,
                  label: "Editable node",
                  headerTitle: "Fallback",
                  description: { status: "ready" },
                },
              },
              { data: { id: "beta", type: "text", label: "Target" } },
            ],
            edges: [
              { data: { id: "alpha-beta", source: "alpha", target: "beta" } },
            ],
          }),
        type,
      );
      const node = page.locator('.flow-sdk-node[data-node-id="alpha"]');
      const label = node.locator("p[title]").first();
      await expect(label).toHaveText("Editable node");
      const before = await node.evaluate((element: HTMLElement) => {
        const label = element.querySelector<HTMLElement>("p[title]")!;
        return {
          width: element.offsetWidth,
          height: element.offsetHeight,
          labelWidth: label.offsetWidth,
          labelHeight: label.offsetHeight,
        };
      });
      await label.dblclick();
      const input = node.getByRole("textbox");
      await expect(input).toBeVisible();
      await expect(input).toHaveCSS("outline-style", "none");
      await expect(input).toHaveCSS("box-shadow", "none");
      const expectStableSize = async () => {
        const editing = await node.evaluate((element: HTMLElement) => {
          const input = element.querySelector("input")!;
          return {
            width: element.offsetWidth,
            height: element.offsetHeight,
            inputWidth: input.offsetWidth,
            inputHeight: input.offsetHeight,
          };
        });
        expect(Math.abs(editing.width - before.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(editing.height - before.height)).toBeLessThanOrEqual(1);
        expect(
          Math.abs(editing.inputWidth - before.labelWidth),
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(editing.inputHeight - before.labelHeight),
        ).toBeLessThanOrEqual(1);
        expect(editing.inputWidth).toBeGreaterThan(0);
      };
      await expectStableSize();
      await input.fill("A draft label much longer than the original");
      await expect
        .poll(() =>
          input.evaluate((element: HTMLInputElement) => element.offsetWidth),
        )
        .toBeGreaterThan(before.labelWidth);
      expect(
        await node.evaluate((element: HTMLElement) => element.offsetWidth),
      ).toBeGreaterThan(before.width);
      await expect(input).toBeFocused();
      await input.fill("A long draft ".repeat(80));
      expect(
        await input.evaluate(
          (element: HTMLInputElement) => element.offsetWidth,
        ),
      ).toBeLessThanOrEqual(900);
      await input.press("Escape");
      await expect(label).toHaveText("Editable node");
      expect(
        await node.evaluate((element: HTMLElement) => ({
          width: element.offsetWidth,
          height: element.offsetHeight,
        })),
      ).toEqual({ width: before.width, height: before.height });
      await label.dblclick();
      await input.fill("A longer saved node label");
      await input.press("Enter");
      await expect(label).toHaveText("A longer saved node label");
      if (type !== "objectView")
        expect(
          await node.evaluate((element: HTMLElement) => element.offsetWidth),
        ).toBeGreaterThan(before.width);
    });
  }
}
