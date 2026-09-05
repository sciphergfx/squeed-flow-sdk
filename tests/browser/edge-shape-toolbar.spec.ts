import { expect, test } from "@playwright/test";
import { ready, chooseToolbarOption } from "./helpers";

for (const width of [1440, 390]) {
  test(`selected connection shape persists independently at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=connections");
    await page.evaluate(() =>
      window.__flowTest.configure({
        customEdgeTypes: {
          wave: ({ sourcePoint, targetPoint }) => ({
            d: `M${sourcePoint.x} ${sourcePoint.y} Q${sourcePoint.x} ${sourcePoint.y - 150} ${targetPoint.x} ${targetPoint.y}`,
            label: { x: sourcePoint.x, y: sourcePoint.y - 75, angle: 0 },
          }),
        },
      }),
    );
    const edge = page.locator('.flow-sdk-edge[data-source-property="runtime"]');
    await edge.click();
    const original = await page.evaluate(() =>
      structuredClone(window.__flowTest.document),
    );
    const picker = page.getByRole("combobox", {
      name: "Edge shape",
      exact: true,
    });
    await chooseToolbarOption(picker, "wave");
    await expect(picker).toHaveAttribute("title", "Edge shape: wave");
    await expect(edge.locator("path").first()).toHaveAttribute("d", / Q/);
    await picker.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("selected-edge-shape.png"),
    });
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual({
      ...original,
      alpha: {
        ...original.alpha,
        $connections: original.alpha.$connections.map(
          (connection: object, index: number) =>
            index === 1 ? { ...connection, type: "wave" } : connection,
        ),
      },
    });
    await page
      .getByRole("button", { name: "Edge style animated", exact: true })
      .click();
    await expect(edge.locator("path").first()).toHaveClass(
      /flow-sdk-edge-anim/,
    );
    await chooseToolbarOption(picker, "Default");
    expect(
      await page.evaluate(
        () => window.__flowTest.document.alpha.$connections[1].type,
      ),
    ).toBeUndefined();
    await expect(edge.locator("path").first()).toHaveClass(
      /flow-sdk-edge-anim/,
    );
    await page.evaluate(() =>
      window.__flowTest.configure({ selectionToolbar: { hide: ["style"] } }),
    );
    await expect(picker).toHaveCount(0);
  });
}
