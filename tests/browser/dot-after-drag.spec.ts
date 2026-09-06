import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`dot remains clickable immediately after a canvas pan at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await page
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    const drag = page.getByRole("button", {
      name: "Toggle drag mode",
      exact: true,
    });
    if ((await drag.getAttribute("title")) === "Drag Mode Off (d)")
      await drag.click();
    const node = page.locator('.flow-sdk-node[data-node-id="process"]');
    let previous = "",
      stableSince = Date.now();
    await expect
      .poll(async () => {
        const current =
          (await page.locator(".flow-sdk-nodes").getAttribute("style")) ?? "";
        if (current !== previous) {
          previous = current;
          stableSince = Date.now();
        }
        return Date.now() - stableSince;
      })
      .toBeGreaterThan(400);
    await node.locator("[data-flow-node-surface]").click();
    await expect
      .poll(async () => {
        const bounds = (await node.boundingBox())!;
        return Math.abs(bounds.x + bounds.width / 2 - width / 2);
      })
      .toBeLessThan(1);
    for (const label of ["Show icon", "Show properties"]) {
      const dot = node.getByRole("button", { name: label, exact: true });
      await dot.screenshot();
      await page.mouse.move(8, 475);
      await page.mouse.down();
      await page.mouse.move(38, 495, { steps: 8 });
      await page.mouse.up();
      await expect(dot).toBeVisible();
      await dot.click();
      await expect(node.locator("[data-flow-icon-label]")).toHaveCount(
        label === "Show icon" ? 1 : 0,
      );
    }
  });
}
