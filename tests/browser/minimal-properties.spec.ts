import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`minimal documented properties example edits independent values at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?example=minimal-properties");
    const node = page.locator('.flow-sdk-node[data-node-id="root.form"]');
    await expect(node).toBeVisible();
    await expect(page.locator(".flow-sdk-canvas")).toHaveAttribute(
      "data-edge-mode",
      "auto",
    );
    await node.locator('[aria-haspopup="dialog"]').dblclick();
    const dialog = page.getByRole("dialog", {
      name: "Configure Email notification",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("textbox", { name: /^name$/i })
      .fill("My own properties");
    await dialog.getByRole("textbox", { name: /^name$/i }).press("Tab");
    const editedDialog = page.getByRole("dialog", {
      name: "Configure My own properties",
      exact: true,
    });
    await editedDialog
      .getByRole("spinbutton", { name: /^retries$/i })
      .fill("5");
    await editedDialog.getByRole("group", { name: /^enabled$/i }).getByRole("button", { name: "No", exact: true }).click();
    const bounds = (await editedDialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await editedDialog
      .getByRole("button", { name: "Close node configuration", exact: true })
      .click();
    const preview = page.locator('.flow-sdk-node[data-node-id="root.preview"]');
    await expect(preview).toContainText('"name": "My own properties"');
    await expect(preview).toContainText('"retries": 5');
    await expect(preview).toContainText('"enabled": false');
    await expect(node).toContainText("My own properties");
    await page.screenshot({
      path: `/tmp/squeed-minimal-properties-${width}.png`,
    });
    expect(errors).toEqual([]);
  });
}
