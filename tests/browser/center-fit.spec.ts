import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("center preserves zoom, fit aliases agree, and viewport actions do not trigger layout", async ({
  page,
}) => {
  await ready(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__flowTest.events.filter(
            (event) => event.name === "layout-complete",
          ).length,
      ),
    )
    .toBeGreaterThan(0);
  const result = await page.evaluate(() => {
    const engine = window.__flowTest.engine!;
    engine.zoom(0.2);
    engine.pan({ x: -1000, y: -900 });
    engine.center();
    const centered = { pan: engine.pan(), zoom: engine.zoom() };
    engine.fit(60);
    const fit = { pan: engine.pan(), zoom: engine.zoom() };
    engine.pan({ x: -500, y: -400 });
    engine.centerAndFit(60);
    return { centered, fit, both: { pan: engine.pan(), zoom: engine.zoom() } };
  });
  expect(result.centered.zoom).toBe(0.2);
  expect(result.centered.pan).not.toEqual({ x: -1000, y: -900 });
  expect(result.both).toEqual(result.fit);
  const count = await page.evaluate(
    () =>
      window.__flowTest.events.filter(
        (event) => event.name === "layout-complete",
      ).length,
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await page.evaluate(
      () =>
        window.__flowTest.events.filter(
          (event) => event.name === "layout-complete",
        ).length,
    ),
  ).toBe(count);
});
