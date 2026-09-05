import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`upload error toast is visible and dismissible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=json");
    await page.waitForFunction(
      () => !!window.__flowTest?.engine?.getNodeBox("root.workflow"),
    );
    await page.mouse.click(10, 10);
    await page
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-form/full-interface.ts");
    const toast = page.getByRole("alert");
    await expect(toast).toContainText(
      "full-interface.ts: Unsupported TypeScript type: any",
    );
    await expect(toast).toHaveCSS("position", "fixed");
    const bounds = await toast.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page
      .locator('.flow-sdk-node[data-node-id="root.workflow"]')
      .getByText("Workflow", { exact: true })
      .click();
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Dismiss upload error" }).click();
    await expect(toast).toHaveCount(0);
  });
}
