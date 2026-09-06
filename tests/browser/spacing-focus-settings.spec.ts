import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`spacing slider expands compact node gaps at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.route("**/sdk-test/SDKExamplesPanel.tsx*", async route => {
      const response = await route.fetch();
      const body = await response.text();
      const anchor = "const colors = S.useCustomColors();";
      expect(body).toContain(anchor);
      await route.fulfill({ response, body: body.replace(anchor, `${anchor} window.__spacingContext = context;`) });
    });
    await page.goto(process.env.SDK_TEST_URL!);
    await chooseToolbarOption(page.getByRole("combobox", { name: "Example dataset", exact: true }), "Conditional Workflow");
    await expect(page.locator('[data-node-id="root.step_run"]')).toHaveCount(1);
    await page.evaluate(() => {
      const context = (window as any).__spacingContext;
      context.setNodeViewMode("root.step_run", "properties");
      context.setNodeViewMode("root.step_skip", "properties");
    });
    await chooseToolbarOption(page.getByRole("combobox", { name: "Control examples", exact: true }), "Appearance");
    const panel = page.getByRole("region", { name: "SDK control examples", exact: true });
    await panel.getByRole("combobox", { name: "Node spacing", exact: true }).click();
    const slider = page.getByRole("slider", { name: "Node spacing percentage", exact: true });
    const gap = () => page.evaluate(() => {
      const engine = (window as any).__spacingContext.engineRef.current;
      const first = engine.getNodeBox("root.step_run"), second = engine.getNodeBox("root.step_skip");
      return first && second ? Math.abs(first.y - second.y) - (first.h + second.h) / 2 : 0;
    });
    await slider.focus();
    await slider.press("Home");
    await expect(slider).toHaveValue("50");
    await expect.poll(gap).toBeGreaterThan(0);
    let previous = 0, stable = 0;
    await expect.poll(async () => {
      const current = await gap();
      stable = Math.abs(current - previous) < 0.01 ? stable + 1 : 0;
      previous = current;
      return stable;
    }).toBeGreaterThanOrEqual(3);
    const low = await gap();
    await slider.press("End");
    await expect(slider).toHaveValue("200");
    await expect.poll(gap).toBeGreaterThan(low * 2);
  });

  test(`viewport padding overrides click and branch focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/sdk-test/useSDKNodeFocus.tsx*", async route => {
      const url = new URL(route.request().url());
      if (url.searchParams.has("original")) return route.continue();
      url.searchParams.set("original", "1");
      await route.fulfill({ contentType: "application/javascript", body: `
        import { useSDKNodeFocus as original } from ${JSON.stringify(url.href)};
        export function useSDKNodeFocus(ref, scope, options, compact) {
          const focus = original(ref, scope, options, compact);
          window.__focusSettings = focus;
          if (ref.current && !ref.current.__recording) {
            ref.current.__recording = true;
            for (const name of ["focusNode", "focusBranch", "isolateBranch", "isolateConnections"]) {
              const run = ref.current[name];
              ref.current[name] = (...args) => { (window.__focusCalls ??= []).push([name, ...args]); return run(...args); };
            }
          }
          return focus;
        }
      ` });
    });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator('[data-node-id="process"]')).toBeVisible();
    await chooseToolbarOption(page.getByRole("combobox", { name: "Control examples", exact: true }), "Viewport");
    const panel = page.getByRole("region", { name: "SDK control examples", exact: true });
    await expect(panel.getByLabel("Focus padding", { exact: true })).toHaveValue("90");
    await panel.getByLabel("Focus padding", { exact: true }).fill("140");
    await chooseToolbarOption(panel.getByRole("combobox", { name: "Example node", exact: true }), "process");
    for (const [label, method] of [["Focus node", "focusNode"], ["Focus branch", "focusBranch"]]) {
      await panel.getByRole("button", { name: label, exact: true }).click();
      expect(await page.evaluate(() => (window as any).__focusCalls.at(-1))).toEqual([method, "process", 140, true]);
    }
    await panel.getByRole("button", { name: "Close selection tools", exact: true }).click();
    await page.locator('[data-node-id="process"] [data-flow-node-surface]').click();
    expect(await page.evaluate(() => (window as any).__focusCalls.at(-1))).toEqual(["focusNode", "process", 140, true]);
    await chooseToolbarOption(page.getByRole("combobox", { name: "Control examples", exact: true }), "Viewport");
    await expect(panel.getByLabel("Focus padding", { exact: true })).toHaveValue("140");
    await panel.getByLabel("Focus padding", { exact: true }).fill("0");
    await panel.getByRole("button", { name: "Close selection tools", exact: true }).click();
    await page.locator('[data-node-id="process"] [data-flow-node-surface]').click();
    expect(await page.evaluate(() => (window as any).__focusCalls.at(-1))).toEqual(["focusNode", "process", 0, true]);
  });
}