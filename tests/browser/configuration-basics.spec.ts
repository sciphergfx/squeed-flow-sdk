import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`small configuration lessons share and export values at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/sdk-test/SDKExamplesPanel.tsx*", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const anchor = "const colors = S.useCustomColors();";
      expect(body).toContain(anchor);
      await route.fulfill({
        response,
        body: body.replace(
          anchor,
          `${anchor} window.__lesson = { context, nodeById, edgeById };`,
        ),
      });
    });
    await page.goto(process.env.SDK_TEST_URL!);
    const dataset = page.getByRole("combobox", {
      name: "Example dataset",
      exact: true,
    });
    const categories = page.getByRole("combobox", {
      name: "Control examples",
      exact: true,
    });
    const panel = page.getByRole("region", {
      name: "SDK control examples",
      exact: true,
    });
    const openNode = async (id: string) => {
      if (await panel.isVisible())
        await panel
          .getByRole("button", { name: "Close selection tools", exact: true })
          .click();
      await expect
        .poll(() =>
          page.evaluate(
            (id) =>
              (window as any).__lesson.context.engineRef.current?.getNodeBox(id)
                ?.w,
            id,
          ),
        )
        .toBeGreaterThan(0);
      await page.evaluate((id) => {
        const engine = (window as any).__lesson.context.engineRef.current;
        const box = engine.getNodeBox(id);
        engine.zoom(0.7);
        engine.pan({ x: innerWidth / 2 - box.x * 0.7, y: 360 - box.y * 0.7 });
      }, id);
      await page
        .locator(
          `.flow-sdk-node[data-node-id="${id}"] [aria-haspopup="dialog"]`,
        )
        .first()
        .press("Enter");
      await expect(page.locator("dialog[open]")).toBeVisible();
      return page.locator("dialog[open]");
    };
    const closeForm = async () =>
      page
        .getByRole("button", { name: "Close node configuration", exact: true })
        .click();
    const captureGraph = async (name: string) => {
      if (await panel.isVisible())
        await panel
          .getByRole("button", { name: "Close selection tools", exact: true })
          .click();
      await page.evaluate(() => {
        const { context } = (window as any).__lesson;
        context.setSelectedNodeIds([]);
        context.engineRef.current.centerAndFit(60, false);
      });
      await page.screenshot({ path: `/tmp/squeed-${name}-${width}.png` });
    };
    const exportValues = async () => {
      await chooseToolbarOption(categories, "Forms");
      const download = page.waitForEvent("download");
      await panel
        .getByRole("button", { name: "Export example values", exact: true })
        .click();
      return JSON.parse(readFileSync((await (await download).path())!, "utf8"));
    };
    await chooseToolbarOption(dataset, "Shared Configuration");
    await expect(
      panel.getByRole("region", { name: "Configuration walkthrough" }),
    ).toContainText("configRef: receipt");
    let form = await openNode("root.receipt");
    await form
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Changed once for both");
    await form
      .getByRole("textbox", { name: "Message", exact: true })
      .press("Tab");
    await closeForm();
    for (const id of ["root.first", "root.second"]) {
      form = await openNode(id);
      await expect(
        form.getByRole("textbox", { name: "Message", exact: true }),
      ).toHaveValue("Changed once for both");
      await closeForm();
    }
    let exported = await exportValues();
    expect(exported.steps.map((step: any) => step.config.message)).toEqual([
      "Changed once for both",
      "Changed once for both",
    ]);
    expect(exported.configs).toBeUndefined();
    expect(exported.steps[0].configRef).toBeUndefined();
    await expect(page.locator('[data-node-id="root.resolved"]')).toContainText(
      "Changed once for both",
    );
    await captureGraph("shared-configuration");

    await chooseToolbarOption(dataset, "Reusable Property");
    const toggle = panel.getByRole("button", {
      name: "Reusable DeliveryConfig.message",
      exact: true,
    });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    form = await openNode("root.second");
    const select = form.getByRole("combobox", { name: "Message", exact: true });
    await expect(
      select.locator("option").filter({ hasText: /message.*first/i }),
    ).toHaveCount(1);
    const options = await select.locator("option").allTextContents();
    const sharedIndex = options.findIndex((label) =>
      /message.*first/i.test(label),
    );
    expect(sharedIndex).toBeGreaterThan(0);
    await select.selectOption({ index: sharedIndex });
    await closeForm();
    const resource = await page.evaluate(
      () =>
        [...(window as any).__lesson.edgeById.values()]
          .map((edge: any) => edge.data)
          .find(
            (edge: any) =>
              edge.target === "root.second" &&
              edge.targetProperty === "config:message",
          )?.source,
    );
    expect(resource).toBeTruthy();
    form = await openNode(resource);
    await form
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("One reusable message");
    await form
      .getByRole("textbox", { name: "Message", exact: true })
      .press("Tab");
    await closeForm();
    exported = await exportValues();
    expect(exported.steps.map((step: any) => step.config)).toEqual([
      { message: "One reusable message", enabled: true },
      { message: "One reusable message", enabled: false },
    ]);
    expect(exported.sdkResources).toBeUndefined();
    await captureGraph("reusable-property");
    await chooseToolbarOption(categories, "Forms");
    await toggle.click();
    await expect(
      page.locator('.flow-sdk-node[data-node-id^="root.resource_"]'),
    ).toHaveCount(0);
    expect(await exportValues()).toEqual(exported);
    await chooseToolbarOption(dataset, "Shared Configuration");
    expect((await exportValues()).steps[0].config.message).toBe(
      "Changed once for both",
    );
    expect(errors).toEqual([]);
  });
}
