import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  for (const compact of [true, false]) {
    test(`clearing connected focus restores the custom pre-click viewport (${width}px, compact=${compact})`, async ({ page }) => {
      await page.route("**/sdk-test/useSDKNodeFocus.tsx*", async route => {
        const url = new URL(route.request().url());
        if (url.searchParams.has("original")) return route.continue();
        url.searchParams.set("original", "1");
        await route.fulfill({ contentType: "application/javascript", body: `
          import { useSDKNodeFocus as original } from ${JSON.stringify(url.href)};
          export function useSDKNodeFocus(...args) { window.__focusRef = args[0]; return original(...args); }
        ` });
      });
      await page.setViewportSize({ width, height: 950 });
      await page.goto(process.env.SDK_TEST_URL!);
      await chooseToolbarOption(page.getByRole("combobox", { name: "Control examples", exact: true }), "Layout");
      const panel = page.getByRole("region", { name: "SDK control examples", exact: true });
      const pill = panel.getByRole("button", { name: "Compact property layout", exact: true });
      if (!compact) await pill.click();
      await expect(pill).toHaveAttribute("aria-pressed", String(compact));
      await panel.getByRole("button", { name: "Close selection tools", exact: true }).click();
      let previous = "", stableSince = Date.now();
      await expect.poll(async () => {
        const current = await page.locator(".flow-sdk-nodes").getAttribute("style") ?? "";
        if (current !== previous) { previous = current; stableSince = Date.now(); }
        return Date.now() - stableSince;
      }).toBeGreaterThan(400);
      const before = await page.evaluate(() => {
        const engine = (window as any).__focusRef.current;
        const pan = engine.pan();
        engine.zoom(engine.zoom() * 0.75);
        engine.pan({ x: pan.x + 23, y: pan.y - 17 });
        return { pan: engine.pan(), zoom: engine.zoom() };
      });
      const viewport = () => page.evaluate(() => {
        const engine = (window as any).__focusRef.current;
        return { pan: engine.pan(), zoom: engine.zoom() };
      });
      const start = page.locator('.flow-sdk-node[data-node-id="start"] [data-flow-node-surface]');
      await start.click();
      await expect.poll(viewport).not.toEqual(before);
      await start.click({ modifiers: ["Shift"] });
      await expect(page.locator(".flow-sdk-node:visible")).toHaveCount(2);
      await page.locator('.flow-sdk-node[data-node-id="process"] [data-flow-node-surface]').click({ modifiers: ["Shift"] });
      await page.mouse.click(8, 475);
      await expect(page.locator(".flow-sdk-node:visible")).toHaveCount(4);
      await expect.poll(viewport).toEqual(before);
      await page.mouse.click(8, 475);
      expect(await viewport()).toEqual(before);
      const second = await page.evaluate(() => {
        const engine = (window as any).__focusRef.current;
        const pan = engine.pan();
        engine.pan({ x: pan.x + 11, y: pan.y + 9 });
        return { pan: engine.pan(), zoom: engine.zoom() };
      });
      await start.click();
      await expect.poll(viewport).not.toEqual(second);
      await page.mouse.click(8, 475);
      await expect.poll(viewport).toEqual(second);
    });
  }
}