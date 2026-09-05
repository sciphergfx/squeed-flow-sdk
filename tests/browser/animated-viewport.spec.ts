import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("animated fit reaches the instant target and can be overridden", async ({ page }) => {
  await ready(page);
  await expect.poll(() => page.evaluate(() => window.__flowTest.events.some(event => event.name === "layout-complete"))).toBe(true);
  const target = await page.evaluate(() => {
    const engine = window.__flowTest.engine!;
    engine.fit(60, false);
    const target = { pan: engine.pan(), zoom: engine.zoom() };
    engine.pan({ x: -1000, y: -800 });
    engine.zoom(0.1);
    window.__flowTest.events.length = 0;
    engine.fit(60, true);
    return target;
  });
  await expect.poll(() => page.evaluate(() => ({ pan: window.__flowTest.engine!.pan(), zoom: window.__flowTest.engine!.zoom() }))).toEqual(target);
  expect(await page.evaluate(() => window.__flowTest.events.filter(event => event.name === "viewport").length)).toBeGreaterThan(2);
  await page.evaluate(() => {
    const engine = window.__flowTest.engine!;
    engine.pan({ x: -700, y: -600 });
    engine.focusNode("alpha", 50, true);
    engine.pan({ x: 123, y: 456 });
  });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 450)));
  expect(await page.evaluate(() => window.__flowTest.engine!.pan())).toEqual({ x: 123, y: 456 });
  await page.evaluate(() => window.__flowTest.configure({ animateViewport: true }));
  const instant = await page.evaluate(() => {
    window.__flowTest.engine!.centerAndFit(60, false);
    return { pan: window.__flowTest.engine!.pan(), zoom: window.__flowTest.engine!.zoom() };
  });
  expect(instant).toEqual(target);
});

test("reduced motion keeps animated requests instant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await expect.poll(() => page.evaluate(() => window.__flowTest.events.some(event => event.name === "layout-complete"))).toBe(true);
  const result = await page.evaluate(() => {
    const engine = window.__flowTest.engine!;
    engine.fit(50, false);
    const expected = { pan: engine.pan(), zoom: engine.zoom() };
    engine.pan({ x: -900, y: -800 });
    engine.fit(50, true);
    return { expected, actual: { pan: engine.pan(), zoom: engine.zoom() } };
  });
  expect(result.actual).toEqual(result.expected);
});