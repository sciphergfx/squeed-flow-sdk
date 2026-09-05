import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`mixed shape connectors join ports without retracing at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator(".flow-sdk-node").first()).toBeVisible();
    await page
      .getByRole("combobox", { name: "Example dataset", exact: true })
      .click();
    await page
      .getByRole("listbox", { name: "Example dataset", exact: true })
      .getByRole("option", { name: "Mixed Views", exact: true })
      .click();
    const shape = page.locator('.flow-sdk-node[data-node-id="shape-start"]');
    await expect(
      shape.getByRole("button", { name: "Connect out", exact: true }),
    ).toBeVisible();
    await shape.screenshot();
    for (const [edgeId, sourceId, targetId] of [
      ["shape-start-decision", "shape-start", "shape-decision"],
      ["shape-decision-process", "shape-decision", "shape-process"],
    ]) {
      await expect
        .poll(() =>
          page.evaluate(
            ({ edgeId, sourceId, targetId }) => {
              const edge = document.querySelector(
                `.flow-sdk-edge[data-edge-id="${edgeId}"]`,
              )!;
              const paths =
                edge.querySelectorAll<SVGPathElement>(":scope > path");
              const line = paths[0];
              const arrow = paths[1];
              if (!line || !arrow) return { connected: false, retraces: true };
              const portCenter = (nodeId: string, role: string) => {
                const host = document.querySelector(
                  `.flow-sdk-node[data-node-id="${nodeId}"]`,
                ) as HTMLElement;
                const port = host
                  .querySelector(
                    `.flow-sdk-property-port[data-port-role="${role}"]`,
                  )!
                  .getBoundingClientRect();
                return {
                  x: port.x + port.width / 2,
                  y: port.y + port.height / 2,
                  scale: host.getBoundingClientRect().width / host.offsetWidth,
                };
              };
              const source = portCenter(sourceId, "source");
              const target = portCenter(targetId, "target");
              const start = line
                .getPointAtLength(0)
                .matrixTransform(line.getScreenCTM()!);
              const tip = arrow
                .getPointAtLength(0)
                .matrixTransform(arrow.getScreenCTM()!);
              const connected =
                Math.abs(start.x - source.x) < 1 &&
                Math.abs(start.y - source.y - source.scale * 18) < 1 &&
                Math.abs(tip.x - target.x) < 1 &&
                Math.abs(tip.y - target.y + target.scale * 18) < 1;
              const length = line.getTotalLength();
              const samples = Array.from({ length: 513 }, (_, index) =>
                line.getPointAtLength((length * index) / 512),
              );
              const retraces = samples.slice(1, -1).some((point, index) => {
                const before = samples[index];
                const after = samples[index + 2];
                return (
                  (point.x - before.x) * (after.x - point.x) +
                    (point.y - before.y) * (after.y - point.y) <
                  -0.01
                );
              });
              return { connected, retraces };
            },
            { edgeId, sourceId, targetId },
          ),
        )
        .toEqual({ connected: true, retraces: false });
    }
    await page.screenshot({
      path: test.info().outputPath("mixed-shape-connectors.png"),
    });
    expect(errors).toEqual([]);
  });
}
