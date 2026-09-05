import { expect, test } from "@playwright/test";
import { centerOfNode, dragBetween, ready } from "./helpers";

test("drawn JSON cross-links support label, style, color and deletion", async ({
  page,
}) => {
  await ready(page, "?graph=json");
  await page.evaluate(() =>
    window.__flowTest.configure({ isEdgeHandlesEnabled: true }),
  );
  await expect(page.locator(".flow-sdk-canvas")).toHaveClass(/flow-sdk-draw/);
  await dragBetween(
    page,
    await centerOfNode(page, "root.beta"),
    await centerOfNode(page, "root.gamma"),
  );
  await expect
    .poll(() => page.evaluate(() => window.__flowTest.document.beta.$target))
    .toBe("root.gamma");
  await page.evaluate(() =>
    window.__flowTest.configure({ isEdgeHandlesEnabled: false }),
  );
  await expect(page.locator(".flow-sdk-canvas")).not.toHaveClass(
    /flow-sdk-draw/,
  );
  const edge = page.locator(
    '.flow-sdk-edge[data-edge-id="root.beta->root.gamma"]',
  );
  await edge.click();
  const label = page.getByRole("textbox", { name: "Edge label", exact: true });
  await label.fill("Calls");
  await label.press("Enter");
  await page
    .getByRole("button", { name: "Edge style dashed", exact: true })
    .click();
  await expect(edge.locator("path").first()).toHaveAttribute(
    "stroke-dasharray",
    "32 18",
  );
  await page
    .getByRole("button", { name: "Edge style animated", exact: true })
    .click();
  await expect(edge.locator(".flow-sdk-edge-anim")).toHaveCount(1);
  const offset = await edge
    .locator(".flow-sdk-edge-anim")
    .evaluate((path) => getComputedStyle(path).strokeDashoffset);
  await expect
    .poll(() =>
      edge
        .locator(".flow-sdk-edge-anim")
        .evaluate((path) => getComputedStyle(path).strokeDashoffset),
    )
    .not.toBe(offset);
  const swatch = page.getByRole("button", {
    name: "Edge color red.500",
    exact: true,
  });
  const color = await swatch.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await swatch.click();
  await expect(edge.locator("path").first()).toHaveCSS("stroke", color);
  expect(
    await page.evaluate(() => window.__flowTest.document.beta),
  ).toMatchObject({
    $targetLabel: "Calls",
    $isEdgeAnimated: true,
    $edgeColor: "red.500",
  });
  await page.getByRole("button", { name: "Delete edge", exact: true }).click();
  await expect(edge).toHaveCount(0);
  expect(
    await page.evaluate(() => window.__flowTest.document.beta.$target),
  ).toBeUndefined();
});

test("compound nodes and self-loops render through direction and theme changes", async ({
  page,
}, testInfo) => {
  await ready(page);
  await page.evaluate(() =>
    window.__flowTest.replaceGraph({
      nodes: [
        { data: { id: "cluster", label: "Workers", type: "parentContainer" } },
        {
          data: {
            id: "first",
            label: "First",
            type: "text",
            parent: "cluster",
          },
        },
        {
          data: {
            id: "second",
            label: "Second",
            type: "text",
            parent: "cluster",
          },
        },
      ],
      edges: [
        {
          data: {
            id: "forward",
            source: "first",
            target: "second",
            label: "Forward",
          },
        },
        {
          data: {
            id: "reverse",
            source: "second",
            target: "first",
            label: "Return",
            isEdgeDashed: true,
            isInverted: true,
          },
        },
        {
          data: {
            id: "loop",
            source: "second",
            target: "second",
            label: "Loop",
          },
        },
      ],
    }),
  );
  await expect(page.locator(".flow-sdk-container")).toHaveCount(1);
  await expect(page.locator(".flow-sdk-edge")).toHaveCount(3);
  await expect(
    page.locator('.flow-sdk-edge[data-edge-id="loop"] path').first(),
  ).toHaveAttribute("d", /Q/);
  for (const direction of ["TB", "RL", "BT", "LR"] as const) {
    await page.evaluate(
      (direction) =>
        window.__flowTest.configure({
          direction,
          colorMode: "dark",
          parentNodeStyle: {
            padding: 100,
            bgColor: "teal.500",
            borderWidth: 4,
          },
        }),
      direction,
    );
    await expect
      .poll(() =>
        page.evaluate((direction) => {
          const engine = window.__flowTest.engine!;
          const first = engine.getNodeBox("first")!,
            second = engine.getNodeBox("second")!;
          const delta =
            direction === "LR" || direction === "RL"
              ? second.x - first.x
              : second.y - first.y;
          return direction === "LR" || direction === "TB"
            ? delta > 0
            : delta < 0;
        }, direction),
      )
      .toBe(true);
    await expect(
      page.locator(".flow-sdk-container rect").first(),
    ).toHaveAttribute("stroke-width", "4");
    expect(
      await page.evaluate(() => {
        const engine = window.__flowTest.engine!;
        const container = engine.getNodeBox("cluster")!;
        return ["first", "second"].every((id) => {
          const node = engine.getNodeBox(id)!;
          return (
            Math.abs(node.x - container.x) + node.w / 2 <=
              container.w / 2 + 1 &&
            Math.abs(node.y - container.y) + node.h / 2 <= container.h / 2 + 1
          );
        });
      }),
    ).toBe(true);
  }
  await page.evaluate(() => window.__flowTest.engine!.fit(50));
  await page.screenshot({
    path: testInfo.outputPath("containers-desktop.png"),
  });
});
