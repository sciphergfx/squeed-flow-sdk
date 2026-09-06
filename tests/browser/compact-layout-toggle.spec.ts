import { expect, test } from "@playwright/test";
import { chooseToolbarOption, ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`SDK compact layout toggle defaults off and controls layout at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=connections");
    await page
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    const toolbar = page.getByRole("toolbar", {
      name: "Diagram controls",
      exact: true,
    });
    const compact = toolbar.getByRole("button", {
      name: "Compact layout",
      exact: true,
    });
    await expect(compact).toHaveText("Compact layout");
    await expect(compact).toHaveAttribute("aria-pressed", "false");
    await expect(
      toolbar.getByRole("button", { name: "Connected nodes", exact: true }),
    ).toHaveCount(0);
    await chooseToolbarOption(
      toolbar.getByRole("combobox", { name: "Edge mode", exact: true }),
      "Properties",
    );
    const rootLaidOut = () =>
      page.evaluate(() => !!window.__flowTest.engine!.getNodeBox("root"));
    await expect.poll(rootLaidOut).toBe(true);
    await compact.click();
    await expect(compact).toHaveAttribute("aria-pressed", "true");
    await expect.poll(rootLaidOut).toBe(false);
    await compact.click();
    await expect(compact).toHaveAttribute("aria-pressed", "false");
    await expect.poll(rootLaidOut).toBe(true);
    await page.evaluate(() =>
      window.__flowTest.configure({ compactPropertyLayout: true }),
    );
    await expect(compact).toHaveAttribute("aria-pressed", "true");
    await expect.poll(rootLaidOut).toBe(false);
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(compact).toBeDisabled();
  });
}
