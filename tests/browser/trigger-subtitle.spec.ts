import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`trigger subtitle follows state without showing config at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator(".flow-sdk-node").first()).toBeVisible();
    await page
      .getByRole("combobox", { name: "Example dataset", exact: true })
      .click();
    await page
      .getByRole("listbox", { name: "Example dataset", exact: true })
      .getByRole("option", { name: "Workflow State", exact: true })
      .click();
    const node = page.locator('.flow-sdk-node[data-node-id="root.trigger"]');
    const label = node.getByText("On Create User", { exact: true });
    const subtitle = node.locator("[data-flow-node-subtitle]");
    await expect(subtitle).toHaveText("user.created");
    await expect(page.locator("[data-flow-config-summary]")).toHaveCount(0);
    await node.screenshot({
      path: test.info().outputPath("trigger-subtitle.png"),
    });
    const titleBounds = (await label.boundingBox())!;
    const subtitleBounds = (await subtitle.boundingBox())!;
    expect(subtitleBounds.y).toBeGreaterThan(
      titleBounds.y + titleBounds.height,
    );
    expect(
      Math.abs(
        subtitleBounds.x +
          subtitleBounds.width / 2 -
          titleBounds.x -
          titleBounds.width / 2,
      ),
    ).toBeLessThan(1);
    await label.dblclick();
    const form = page.getByRole("dialog", {
      name: "Configure On Create User",
      exact: true,
    });
    const event = form.getByRole("textbox", { name: "Event", exact: true });
    await event.fill("user.updated");
    await event.press("Enter");
    await page.keyboard.press("Escape");
    await expect(subtitle).toHaveText("user.updated");
    await label.dblclick();
    await form
      .getByRole("combobox", { name: "Type", exact: true })
      .selectOption({ label: "Manual" });
    await page.keyboard.press("Escape");
    await expect(subtitle).toHaveText("manual");
    await label.dblclick();
    await form
      .getByRole("combobox", { name: "Type", exact: true })
      .selectOption({ label: "Schedule" });
    const cron = form.getByRole("textbox", { name: "Cron", exact: true });
    await cron.fill("0 9 * * 1-5");
    await cron.press("Enter");
    await page.keyboard.press("Escape");
    await expect(subtitle).toHaveText("0 9 * * 1-5");
    await expect(page.locator("[data-flow-config-summary]")).toHaveCount(0);
  });
}
