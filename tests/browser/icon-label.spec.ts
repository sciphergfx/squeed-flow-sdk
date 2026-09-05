import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`icon-label view keeps the caption below the icon and opens forms at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=state");
    await page.waitForFunction(
      () => !!window.__flowTest?.engine?.getNodeBox("root.trigger"),
    );
    await page.evaluate(() => {
      const view = window.__flowTest.document;
      window.__flowTest.replaceDocument({
        ...view,
        trigger: { ...view.trigger, $view: "icon-label" },
      });
    });
    const node = page.locator('.flow-sdk-node[data-node-id="root.trigger"]');
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(1);
    const icon = await node.locator("[data-flow-node-surface]").boundingBox();
    const caption = await node
      .locator("[data-flow-icon-caption]")
      .boundingBox();
    expect(caption!.y).toBeGreaterThan(icon!.y + icon!.height);
    expect(
      Math.abs(caption!.x + caption!.width / 2 - icon!.x - icon!.width / 2),
    ).toBeLessThan(1);
    await page.mouse.click(10, 10);
    await page
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-state/interface.ts");
    await expect(page.getByRole("status")).toContainText("4 form types loaded");
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(1);
    await node.getByText("On Create User", { exact: true }).dblclick();
    await expect(
      page.getByRole("dialog", {
        name: "Configure On Create User",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close node configuration", exact: true })
      .click();
    await page.screenshot({ path: testInfo.outputPath("icon-label.png") });
  });
}
