import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  for (const dataset of ["Default", "Advanced", "Workflow State 2"]) {
    test(`JSON playback pauses, seeks and finishes ${dataset} at ${width}px`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 950 });
      await page.goto(process.env.SDK_TEST_URL!);
      await chooseToolbarOption(
        page.getByRole("combobox", { name: "Example dataset", exact: true }),
        dataset,
      );
      if (dataset !== "Default")
        await expect(
          page.locator('.flow-sdk-node[data-node-id="process"]'),
        ).toHaveCount(0);
      if (dataset === "Workflow State 2")
        await expect(
          page.locator(
            '.flow-sdk-node[data-node-id="root.template_execution"]',
          ),
        ).toBeAttached();
      const nodes = page.locator(".flow-sdk-node");
      await expect(nodes.first()).toBeAttached();
      const original = await nodes.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-node-id")).sort(),
      );
      await page.clock.install();
      await page
        .getByRole("button", { name: "Play JSON document", exact: true })
        .click();
      const row = page.getByRole("group", {
        name: "JSON playback",
        exact: true,
      });
      const slider = row.getByRole("slider", {
        name: "JSON playback position",
        exact: true,
      });
      await expect(row.getByRole("button").first()).toHaveAttribute(
        "aria-label",
        "Pause JSON playback",
      );
      await page.clock.runFor(1000);
      await row
        .getByRole("button", { name: "Pause JSON playback", exact: true })
        .click();
      const paused = await slider.inputValue();
      if (dataset === "Default") {
        const surfaceColors = () =>
          row.evaluate((element) => {
            const toolbar = document.querySelector(
              '[aria-label="Example controls"] > div',
            );
            return [
              getComputedStyle(element.parentElement!.parentElement!)
                .backgroundColor,
              getComputedStyle(toolbar!).backgroundColor,
            ];
          });
        let colors = await surfaceColors();
        expect(colors[0]).toBe(colors[1]);
        const initialColor = colors[0];
        await page.getByTestId("theme-toggle").click();
        colors = await surfaceColors();
        expect(colors[0]).toBe(colors[1]);
        expect(colors[0]).not.toBe(initialColor);
        await expect(slider).toHaveCSS("appearance", "none");
      }
      expect(Number(paused)).toBeGreaterThan(0);
      expect(Number(paused)).toBeLessThan(
        Number(await slider.getAttribute("max")),
      );
      await page.clock.runFor(600);
      await expect(slider).toHaveValue(paused);
      await slider.press("Home");
      await expect(slider).toHaveValue("0");
      await row
        .getByRole("button", { name: "Resume JSON playback", exact: true })
        .click();
      await page.clock.runFor(8500);
      await expect(
        row.getByLabel("JSON playback progress", { exact: true }),
      ).toHaveText("100%");
      await expect(row.getByRole("button").first()).toHaveAttribute(
        "aria-label",
        "Resume JSON playback",
      );
      await expect
        .poll(() =>
          nodes.evaluateAll((elements) =>
            elements
              .map((element) => element.getAttribute("data-node-id"))
              .sort(),
          ),
        )
        .toEqual(original);
      const bounds = await row.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      const pauseBounds = await row.getByRole("button").first().boundingBox();
      const sliderBounds = await slider.boundingBox();
      expect(pauseBounds!.x + pauseBounds!.width).toBeLessThanOrEqual(
        sliderBounds!.x,
      );
      await page.screenshot({
        path: test.info().outputPath("playback-complete.png"),
      });
      await row
        .getByRole("button", { name: "Resume JSON playback", exact: true })
        .click();
      await page.clock.runFor(200);
      await chooseToolbarOption(
        page.getByRole("combobox", { name: "Example dataset", exact: true }),
        "Mixed Views",
      );
      await expect(row).toHaveCount(0);
      await page.clock.runFor(500);
      await expect(page.locator('[data-node-id="shape-start"]')).toBeAttached();
      expect(errors).toEqual([]);
    });
  }

  test(`playback interleaves edges and automatically follows new nodes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(
      page.locator('.flow-sdk-node[data-node-id="start"]'),
    ).toBeAttached();
    await page.clock.install();
    await page
      .getByRole("button", { name: "Play JSON document", exact: true })
      .click();
    const nodes = page.locator(".flow-sdk-node");
    for (let tick = 0; tick < 40 && (await nodes.count()) !== 2; tick++)
      await page.clock.runFor(100);
    await expect(nodes).toHaveCount(2);
    await expect(
      page.locator('.flow-sdk-edge[data-edge-id="start-process"]'),
    ).toBeAttached();
    const inViewport = () =>
      nodes.evaluateAll((elements) =>
        elements.every((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.width > 0 &&
            bounds.left >= 0 &&
            bounds.right <= innerWidth &&
            bounds.top >= 0 &&
            bounds.bottom <= innerHeight
          );
        }),
      );
    await expect.poll(inViewport).toBe(true);
    const before = await page.locator(".flow-sdk-nodes").getAttribute("style");
    await page.mouse.move(width / 2, 650);
    await page.mouse.wheel(0, -200);
    await page.mouse.down();
    await page.mouse.move(width / 2 + 80, 720);
    await page.mouse.up();
    await page.clock.runFor(6500);
    await expect(nodes).toHaveCount(4);
    await expect(page.locator(".flow-sdk-edge")).toHaveCount(3);
    await expect.poll(inViewport).toBe(true);
    expect(
      await page.locator(".flow-sdk-nodes").getAttribute("style"),
    ).not.toBe(before);
  });
}
