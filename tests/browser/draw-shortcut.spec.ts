import { expect, test } from "@playwright/test";

test("V toggles draw mode without intercepting typing or paste", async ({
  page,
}) => {
  await page.goto("/?consumerControls=1");
  const canvas = page.locator(".flow-sdk-canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).not.toHaveClass(/flow-sdk-draw/);
  await page.keyboard.press("v");
  await expect(canvas).toHaveClass(/flow-sdk-draw/);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "v", repeat: true }),
    ),
  );
  await expect(canvas).toHaveClass(/flow-sdk-draw/);
  await page.keyboard.press("v");
  await expect(canvas).not.toHaveClass(/flow-sdk-draw/);
  for (const shortcut of ["Control+v", "Meta+v", "Alt+v"]) {
    await page.keyboard.press(shortcut);
    await expect(canvas).not.toHaveClass(/flow-sdk-draw/);
  }
  for (const tag of ["input", "textarea", "select", "div"]) {
    await page.evaluate((tagName) => {
      const field = document.createElement(tagName);
      if (tagName === "div") field.contentEditable = "true";
      field.id = "shortcut-field";
      document.body.append(field);
      field.focus();
    }, tag);
    await page.keyboard.press("v");
    await expect(canvas).not.toHaveClass(/flow-sdk-draw/);
    await page.locator("#shortcut-field").evaluate((field) => field.remove());
  }
  await page.keyboard.press("Shift+V");
  await expect(canvas).toHaveClass(/flow-sdk-draw/);
});

for (const config of [{ readOnly: true }, { disableKeyboardShortcuts: true }]) {
  test(`V respects ${Object.keys(config)[0]}`, async ({ page }) => {
    await page.goto("/?consumerControls=1");
    await page.waitForFunction(() => window.__flowTest?.engine);
    await page.evaluate((next) => window.__flowTest.configure(next), config);
    await page.keyboard.press("v");
    await expect(page.locator(".flow-sdk-canvas")).not.toHaveClass(
      /flow-sdk-draw/,
    );
  });
}
