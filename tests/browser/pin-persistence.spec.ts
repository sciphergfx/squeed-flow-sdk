import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("an explicit unpin survives clicking the graph background", async ({
  page,
}) => {
  await ready(page);

  const toolbar = page.locator(
    '[role="toolbar"][aria-label="Diagram controls"]',
  );
  const pin = toolbar.locator('button[aria-label="Pin"]').first();

  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await pin.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(pin).toHaveAttribute("aria-pressed", "false");

  // Selecting the empty canvas must not re-anchor the toolbar.
  await page.locator(".flow-sdk-canvas").click({ position: { x: 10, y: 100 } });
  await expect(pin).toHaveAttribute("aria-pressed", "false");
});
