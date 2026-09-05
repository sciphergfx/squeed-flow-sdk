import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`content ports connect around the shape at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=basic-json");
    await page.waitForFunction(() => !!window.__flowTest?.engine);
    await page.evaluate(() => {
      window.__flowTest.configure({
        edgeMode: "workflow",
        isEdgeHandlesEnabled: true,
      });
      window.__flowTest.replaceDocument({
        alpha: {
          $label: "Source",
          $content: "Reusable text",
          $ports: [
            { id: "text", role: "source", side: "bottom", position: 0.25 },
          ],
        },
        beta: {
          $label: "Consumer",
          $content: "Uses the shared text",
          $ports: [
            { id: "prompt", role: "target", side: "top", position: 0.75 },
          ],
        },
      });
    });
    const source = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    const target = page.locator('.flow-sdk-node[data-node-id="root.beta"]');
    const output = source.getByRole("button", {
      name: "Connect text",
      exact: true,
    });
    const input = target.getByRole("button", {
      name: "Input prompt",
      exact: true,
    });
    await expect(output).toBeVisible();
    await expect(input).toBeVisible();
    await output.screenshot();
    for (const [node, port, fraction, side] of [
      [source, output, 0.25, "bottom"],
      [target, input, 0.75, "top"],
    ] as const) {
      const surface = (await node
        .locator("[data-flow-node-surface]")
        .boundingBox())!;
      const bounds = (await port.boundingBox())!;
      expect(
        Math.abs(
          bounds.x + bounds.width / 2 - surface.x - surface.width * fraction,
        ),
      ).toBeLessThan(1);
      expect(
        Math.abs(
          bounds.y +
            bounds.height / 2 -
            surface.y -
            (side === "bottom" ? surface.height : 0),
        ),
      ).toBeLessThan(1);
    }
    const from = (await output.boundingBox())!;
    const to = (await input.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    await expect
      .poll(() =>
        page.evaluate(() => window.__flowTest.document.alpha.$connections?.[0]),
      )
      .toMatchObject({
        target: "root.beta",
        sourceProperty: "text",
        targetProperty: "prompt",
      });
    await expect(
      page.locator('.flow-sdk-edge[data-edge-id^="connection:"]'),
    ).toHaveCount(1);
    await page.screenshot({
      path: test.info().outputPath("content-ports.png"),
    });
  });
}
