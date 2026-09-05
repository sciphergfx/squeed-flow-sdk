import { expect, test, type Page } from "@playwright/test";
import type { FlowDirection, NodeAlignment } from "../../src/types";
import { ready } from "./helpers";

async function alignedGap(
  page: Page,
  direction: FlowDirection,
  alignment: NodeAlignment,
) {
  return page.evaluate(
    ({ direction, alignment }) => {
      const horizontal =
        direction === "LR" || direction === "RL" || direction === "C";
      const flowSign = direction === "RL" || direction === "BT" ? -1 : 1;
      const side =
        alignment === "center"
          ? 0
          : alignment === "leading"
            ? -flowSign
            : flowSign;
      const edges = ["narrow", "wide"].map((id) => {
        const node = document.querySelector<HTMLElement>(
          `.flow-sdk-node[data-node-id="${id}"]`,
        )!;
        const box = node.getBoundingClientRect();
        const center = horizontal
          ? box.left + box.width / 2
          : box.top + box.height / 2;
        return center + (side * (horizontal ? box.width : box.height)) / 2;
      });
      return Math.abs(edges[0] - edges[1]);
    },
    { direction, alignment },
  );
}

async function replaceGraph(page: Page, width = 360) {
  await page.evaluate(
    (width) =>
      window.__flowTest.replaceGraph({
        nodes: [
          { data: { id: "origin", label: "Start", type: "text" } },
          {
            data: {
              id: "narrow",
              label: "Narrow",
              type: "text",
              viewProps: { width: 160, height: 80 },
            },
          },
          {
            data: {
              id: "wide",
              label: "Wide",
              type: "text",
              viewProps: { width, height: 180 },
            },
          },
          { data: { id: "end", label: "End", type: "text" } },
        ],
        edges: [
          { data: { id: "origin-narrow", source: "origin", target: "narrow" } },
          { data: { id: "origin-wide", source: "origin", target: "wide" } },
          { data: { id: "narrow-end", source: "narrow", target: "end" } },
          { data: { id: "wide-end", source: "wide", target: "end" } },
        ],
      }),
    width,
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.__flowTest.engine!.getNodeBox("wide")?.w),
    )
    .toBe(width);
  await expect(page.locator(".flow-sdk-edge")).toHaveCount(4);
}

for (const direction of ["LR", "RL", "TB", "BT", "C"] as const) {
  test(`${direction} alignment config updates node edges without replacing the graph`, async ({
    page,
  }) => {
    await ready(page, "?custom=1");
    await page.evaluate(
      (direction) => window.__flowTest.configure({ direction }),
      direction,
    );
    await replaceGraph(page);
    await expect
      .poll(() => alignedGap(page, direction, "center"))
      .toBeLessThan(0.1);
    const initializations = await page.evaluate(
      () =>
        window.__flowTest.events.filter((event) => event.name === "init")
          .length,
    );
    const path = page
      .locator('.flow-sdk-edge[data-edge-id="origin-narrow"] path')
      .first();
    for (const alignment of ["leading", "trailing", "center"] as const) {
      const previousPath = await path.getAttribute("d");
      await page.evaluate(
        (nodeAlignment) => window.__flowTest.configure({ nodeAlignment }),
        alignment,
      );
      await expect
        .poll(() => alignedGap(page, direction, alignment))
        .toBeLessThan(0.1);
      await expect(path).not.toHaveAttribute("d", previousPath!);
      await expect(page.locator(".flow-sdk-node")).toHaveCount(4);
      await expect(page.locator(".flow-sdk-edge")).toHaveCount(4);
    }
    expect(
      await page.evaluate(
        () =>
          window.__flowTest.events.filter((event) => event.name === "init")
            .length,
      ),
    ).toBe(initializations);
  });
}

test("leading alignment is recomputed when node width changes", async ({
  page,
}, testInfo) => {
  await ready(page, "?custom=1");
  await page.evaluate(() =>
    window.__flowTest.configure({ nodeAlignment: "leading" }),
  );
  await replaceGraph(page);
  await expect.poll(() => alignedGap(page, "LR", "leading")).toBeLessThan(0.1);
  await replaceGraph(page, 500);
  await expect.poll(() => alignedGap(page, "LR", "leading")).toBeLessThan(0.1);
  await page.evaluate(() => window.__flowTest.engine!.fit(50));
  await page.screenshot({ path: testInfo.outputPath("leading-alignment.png") });
});
