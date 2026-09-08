import { expect, test } from "@playwright/test";

test("direction refits inherit viewport animation and respect opt-out", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.waitForFunction(() => window.__flowTest?.engine);
  for (const animateViewport of [true, false, true]) {
    await page.evaluate((animate) => {
      window.__flowTest.configure({
        animateViewport: animate,
        direction: animate ? "TB" : "LR",
      });
    }, animateViewport);
    await expect.poll(() => page.evaluate(() => {
      const engine = window.__flowTest.engine!;
      const source = engine.getNodeBox("alpha")!;
      const target = engine.getNodeBox("beta")!;
      if (!source || !target) return null;
      return Math.abs(target.y - source.y) > Math.abs(target.x - source.x);
    })).toBe(animateViewport);
    const changes = await page.evaluate(async () => {
      const engine = window.__flowTest.engine!;
      engine.pan({ x: -500, y: -500 });
      const samples: number[] = [];
      const unsubscribe = engine.onViewportChange(({ pan }) => samples.push(pan.x));
      engine.centerAndFit(60);
      await new Promise<void>((resolve) => {
        const start = performance.now();
        const frame = () => {
          if (performance.now() - start >= 600) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      unsubscribe();
      return new Set(samples).size;
    });
    if (animateViewport) expect(changes).toBeGreaterThan(2);
    else expect(changes).toBe(1);
  }
});