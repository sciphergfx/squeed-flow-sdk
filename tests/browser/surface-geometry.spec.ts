import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`connectors and animation follow visible node shapes at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator(".flow-sdk-node").first()).toBeVisible();
    const dataset = async (option: string) => {
      await page
        .getByRole("combobox", { name: "Example dataset", exact: true })
        .click();
      await page
        .getByRole("listbox", { name: "Example dataset", exact: true })
        .getByRole("option", { name: option, exact: true })
        .click();
    };
    for (const [view, nodeId, label, shapeTag, edgeId] of [
      [
        "Workflow State",
        "root.decision",
        "Is a manager?",
        "rect",
        "connections",
      ],
      ["Shapes", "shape-start", "Start", "path", "shape-start-decision"],
      [
        "Shapes",
        "shape-decision",
        "Approved?",
        "path",
        "shape-decision-process",
      ],
      ["Shapes", "shape-process", "Process", "path", ""],
    ]) {
      if (nodeId === "root.decision" || nodeId === "shape-start")
        await dataset(view);
      const node = page.locator(`.flow-sdk-node[data-node-id="${nodeId}"]`);
      const surface = node.locator("[data-flow-node-surface]");
      await expect(surface).toBeVisible();
      await node.getByText(label, { exact: true }).first().click();
      await page
        .getByRole("button", { name: "Toggle node animation", exact: true })
        .click();
      const animation = node.locator(
        `${shapeTag}.flow-sdk-node-border-animation`,
      );
      await expect(animation).toBeVisible();
      await expect
        .poll(async () =>
          node.evaluate((element) => {
            const surface = element
              .querySelector("[data-flow-node-surface]")!
              .getBoundingClientRect();
            const animation = element
              .querySelector(".flow-sdk-node-border-animation")!
              .getBoundingClientRect();
            return Math.max(
              Math.abs(
                surface.x +
                  surface.width / 2 -
                  animation.x -
                  animation.width / 2,
              ),
              Math.abs(
                surface.y +
                  surface.height / 2 -
                  animation.y -
                  animation.height / 2,
              ),
            );
          }),
        )
        .toBeLessThan(1);
      const sizes = await node.evaluate((element) => {
        const surface = element
          .querySelector("[data-flow-node-surface]")!
          .getBoundingClientRect();
        const animation = element
          .querySelector(".flow-sdk-node-border-animation")!
          .getBoundingClientRect();
        return {
          width: animation.width / surface.width,
          height: animation.height / surface.height,
        };
      });
      expect(sizes.width).toBeGreaterThan(0.8);
      expect(sizes.width).toBeLessThanOrEqual(1.01);
      expect(sizes.height).toBeGreaterThan(0.8);
      expect(sizes.height).toBeLessThanOrEqual(1.01);
      if (edgeId) {
        await expect
          .poll(() =>
            page.evaluate(
              ({ nodeId, edgeId }) => {
                const surface = document
                  .querySelector(
                    `.flow-sdk-node[data-node-id="${nodeId}"] [data-flow-node-surface]`,
                  )!
                  .getBoundingClientRect();
                const edge = [
                  ...document.querySelectorAll(".flow-sdk-edge"),
                ].find((element) => {
                  const id = element.getAttribute("data-edge-id") ?? "";
                  return (
                    id === edgeId ||
                    (edgeId === "connections" &&
                      id.startsWith("connection:") &&
                      id.includes(nodeId))
                  );
                });
                const path = edge?.querySelector("path") as
                  | SVGPathElement
                  | undefined;
                if (!path) return Infinity;
                const start = path
                  .getPointAtLength(0)
                  .matrixTransform(path.getScreenCTM()!);
                if (edgeId !== "connections") {
                  const host = document.querySelector(
                    `.flow-sdk-node[data-node-id="${nodeId}"]`,
                  ) as HTMLElement;
                  const port = host
                    .querySelector(
                      '.flow-sdk-property-port[data-property="out"]',
                    )
                    ?.getBoundingClientRect();
                  if (!port) return Infinity;
                  const zoom =
                    host.getBoundingClientRect().width / host.offsetWidth;
                  return Math.max(
                    Math.abs(start.x - port.x - port.width / 2),
                    Math.abs(start.y - port.y - port.height / 2 - 18 * zoom),
                  );
                }
                return Math.abs(start.y - surface.y - surface.height / 2);
              },
              { nodeId, edgeId },
            ),
          )
          .toBeLessThan(1);
      }
      await surface.screenshot({
        path: test.info().outputPath(`${nodeId}-surface.png`),
      });
    }
    expect(errors).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath("custom-shapes.png"),
    });
  });
}
