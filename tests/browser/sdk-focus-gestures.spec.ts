import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`SDK Test opts into click focus, shift isolation and background restore at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const nodes = page.locator(".flow-sdk-node:visible");
    const start = page.locator('.flow-sdk-node[data-node-id="start"]');
    const toggle = page.getByRole("button", {
      name: "Connected nodes",
      exact: true,
    });
    await expect(nodes).toHaveCount(4);
    await page
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
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
    const before = await page.locator(".flow-sdk-nodes").getAttribute("style");
    await start.locator("[data-flow-node-surface]").click();
    await expect
      .poll(() => page.locator(".flow-sdk-nodes").getAttribute("style"))
      .not.toBe(before);
    await expect(nodes).toHaveCount(4);
    await expect
      .poll(async () => {
        const bounds = (await start.boundingBox())!;
        return Math.abs(bounds.x + bounds.width / 2 - width / 2);
      })
      .toBeLessThan(1);
    await start
      .locator("[data-flow-node-surface]")
      .click({ modifiers: ["Shift"] });
    await expect(nodes).toHaveCount(2);
    await expect(
      page.locator('.flow-sdk-node[data-node-id="process"]'),
    ).toHaveCount(1);
    await expect(toggle).toBeHidden();
    await page.mouse.click(8, 475);
    await expect(nodes).toHaveCount(4);
    await expect(page.locator(".flow-sdk-edge")).toHaveCount(3);
    await expect
      .poll(() => page.locator(".flow-sdk-nodes").getAttribute("style"))
      .toBe(before);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await start.locator("[data-flow-node-surface]").click();
    await expect(nodes).toHaveCount(2);
    await page
      .getByRole("toolbar", { name: "Diagram controls", exact: true })
      .getByRole("button", { name: "Close selection tools", exact: true })
      .click();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(nodes).toHaveCount(4);
    await expect(page.locator(".flow-sdk-edge")).toHaveCount(3);
    await expect
      .poll(() => page.locator(".flow-sdk-nodes").getAttribute("style"))
      .toBe(before);
    await page.screenshot({
      path: test.info().outputPath("focus-toolbar.png"),
    });
    expect(errors).toEqual([]);
  });
}
