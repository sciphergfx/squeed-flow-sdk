import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("expanded toolbar stays open after pointer and window leave until collapsed", async ({ page }) => {
  await ready(page);
  const toolbar = page.getByRole("toolbar", { name: "Diagram controls" }).locator(":scope > div");
  const toggle = page.getByRole("button", { name: "Toggle toolbar collapse", exact: true });
  await toggle.click();
  await page.mouse.move(30, 30);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent("mouseleave")));
  await expect(toolbar).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle zoom mode", exact: true })).toBeVisible();
  await toggle.click();
  await expect(page.getByRole("button", { name: "Toggle zoom mode", exact: true })).toHaveCount(0);
  await expect(toolbar).toBeVisible();
});

test("toolbar hides explicitly and stays open after reopening from its indicator", async ({ page }) => {
  await ready(page);
  const toolbar = page.getByRole("toolbar", { name: "Diagram controls" }).locator(":scope > div");
  const pin = page.getByRole("button", { name: "Pin", exact: true });
  await pin.click();
  await expect(toolbar).toBeHidden();
  await page.mouse.move(700, 880);
  await expect(toolbar).toBeHidden();
  await page.getByRole("button", { name: "Show Bottom Bar", exact: true }).hover();
  await page.mouse.move(30, 30);
  await expect(toolbar).toBeVisible();
  await pin.click();
  await expect(toolbar).toBeHidden();
});

test("direction picker stays open until toggled closed or a direction is chosen", async ({ page }) => {
  await ready(page);
  const direction = page.getByRole("button", { name: "Direction", exact: true });
  const option = page.getByText("Top to Bottom", { exact: true });
  await direction.click();
  await page.mouse.move(30, 30);
  await expect(option).toBeVisible();
  await direction.click();
  await expect(option).toHaveCount(0);
  await direction.click();
  await option.click();
  await expect(option).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Diagram controls" })).toContainText("TB");
});

test("opening selection tools keeps the toolbar visible after deselection", async ({ page }) => {
  await ready(page);
  const toolbar = page.getByRole("toolbar", { name: "Diagram controls" }).locator(":scope > div");
  await page.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(toolbar).toBeHidden();
  await page.locator('.flow-sdk-node[data-node-id="alpha"]').click();
  await expect(page.getByRole("textbox", { name: "Node label", exact: true })).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.getByRole("textbox", { name: "Node label", exact: true })).toHaveCount(0);
  await expect(toolbar).toBeVisible();
});

test.describe("touch toolbar", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("can be closed and reopened explicitly", async ({ page }) => {
    await ready(page);
    const toolbar = page.getByRole("toolbar", { name: "Diagram controls" }).locator(":scope > div");
    await page.getByRole("button", { name: "Pin", exact: true }).tap();
    await expect(toolbar).toBeHidden();
    await page.getByRole("button", { name: "Show Bottom Bar", exact: true }).tap();
    await expect(toolbar).toBeVisible();
    await page.getByRole("button", { name: "Pin", exact: true }).tap();
    await expect(toolbar).toBeHidden();
  });
});