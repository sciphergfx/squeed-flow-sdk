import { expect, test, type Locator } from "@playwright/test";
import { ready } from "./helpers";

async function checkPulse(surface: Locator, trigger = surface) {
  await trigger.hover();
  const frames = await surface.evaluate((element) => {
    const animation = element
      .getAnimations()
      .find((entry) =>
        (entry.effect as KeyframeEffect)
          .getKeyframes()
          .some((frame) => frame.boxShadow),
      );
    if (!animation) throw new Error("Missing hover shadow animation");
    animation.pause();
    const delay = animation.effect!.getTiming().delay;
    const duration = animation.effect!.getTiming().duration;
    const sample = (time: number) => {
      animation.currentTime = time;
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return {
        spread: Number.parseFloat(
          style.boxShadow.match(/-?\d+(?:\.\d+)?px/g)!.at(-1)!,
        ),
        width: bounds.width,
        height: bounds.height,
        border: style.borderColor,
      };
    };
    const start = sample(0);
    const waiting = sample(delay - 1);
    const peak = sample(delay + 300);
    const held = sample(delay + 600);
    const returning = sample(delay + 900);
    const end = sample(delay + 1200);
    animation.finish();
    return { delay, duration, start, waiting, peak, held, returning, end };
  });
  expect(frames.delay).toBe(600);
  expect(frames.duration).toBe(1200);
  expect(frames.start.spread).toBe(8);
  expect(frames.waiting).toEqual(frames.start);
  expect(frames.peak.spread - frames.start.spread).toBe(10);
  expect(frames.held).toEqual(frames.peak);
  expect(frames.returning.spread).toBeGreaterThan(8);
  expect(frames.returning.spread).toBeLessThan(18);
  expect(frames.end).toEqual(frames.start);
  expect(frames.peak.width).toBe(frames.start.width);
  expect(frames.peak.height).toBe(frames.start.height);
  expect(frames.peak.border).toBe(frames.start.border);
}

for (const width of [1440, 390]) {
  test(`hover pulses and selection stays static without resizing at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json");
    const node = page
      .locator(
        '.flow-sdk-node[data-node-id="root.alpha"] [data-flow-node-surface]',
      )
      .first();
    const border = await node.evaluate(
      (element) => getComputedStyle(element).borderColor,
    );
    await checkPulse(node);
    await page.mouse.move(5, 5);
    await expect(node).toHaveCSS("box-shadow", /0px$/);
    await checkPulse(node);
    await node.click();
    await page.mouse.move(5, 5);
    await expect(node).toHaveCSS("border-color", border);
    await expect(node).toHaveCSS("outline-style", "none");
    await expect(node).toHaveCSS("box-shadow", /8px/);
    await node.hover();
    await expect(node).toHaveCSS("animation-name", "none");
    await page.mouse.move(5, 5);
    await node.hover();
    await expect(node).toHaveCSS("animation-name", "none");
    const toolbar = page.locator("[data-flow-toolbar-scroll]").locator("..");
    await checkPulse(toolbar);
    await page.screenshot({
      path: test.info().outputPath("selected-shadow.png"),
    });
    await page.mouse.click(5, 5);
    await checkPulse(page.locator("[data-flow-direction-control]"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await node.hover();
    await expect(node).toHaveCSS("animation-name", "none");
    await expect(node).toHaveCSS("box-shadow", /8px$/);
    await toolbar.hover();
    await expect(toolbar).toHaveCSS("animation-name", "none");
  });

  test(`icon captions trigger the node shadow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=state");
    await page.waitForFunction(
      () => !!window.__flowTest?.engine?.getNodeBox("root.trigger"),
    );
    await page.evaluate(() =>
      window.__flowTest.engine!.focusNode("root.trigger", 70),
    );
    const node = page.locator('.flow-sdk-node[data-node-id="root.trigger"]');
    const surface = node.locator("[data-flow-node-surface]");
    const caption = node.locator("[data-flow-icon-caption]");
    for (const selected of [false, true]) {
      if (selected) await caption.click();
      await page.mouse.move(5, 5);
      if (selected) {
        await caption.hover();
        await expect(surface).toHaveCSS("animation-name", "none");
      } else await checkPulse(surface, caption);
      await expect(surface).toHaveCSS("box-shadow", /8px$/);
      await page.mouse.move(5, 5);
      await expect(surface).toHaveCSS("box-shadow", selected ? /8px$/ : /0px$/);
    }
  });

  test(`consumer hover persists and selection stops animation at ${width}px`, async ({
    page,
  }) => {
    test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const node = page.locator('.flow-sdk-node[data-node-id="review"]');
    const surface = node.locator("[data-flow-node-surface]");
    const caption = node.locator("[data-flow-icon-caption]");
    await expect(surface).toBeVisible();
    await expect(surface).toHaveCSS("box-shadow", /0px$/);
    const toolbar = page
      .locator("[data-flow-toolbar-scroll]")
      .first()
      .locator("..");
    for (const [target, trigger] of [
      [surface, caption],
      [surface, caption],
      [toolbar, toolbar],
    ]) {
      await page.mouse.move(5, 100);
      await trigger.hover();
      const timing = await target.evaluate(async (element) => {
        const animation = element.getAnimations()[0];
        if (!animation) throw new Error("Missing hover pulse");
        const { delay, duration } = animation.effect!.getTiming();
        await animation.finished;
        return { delay, duration };
      });
      expect(timing).toEqual({ delay: 600, duration: 1200 });
      await expect(target).toHaveCSS("box-shadow", /8px$/);
      await expect(
        page.getByRole("button", {
          name: "Delete selected nodes",
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await caption.hover();
    await surface.evaluate((element) => {
      const animation = element.getAnimations()[0];
      animation.pause();
      animation.currentTime = 1050;
    });
    await expect(surface).toHaveCSS("box-shadow", /18px$/);
    await caption.click();
    await expect(surface).toHaveCSS("animation-name", "none");
    await expect(surface).toHaveCSS("box-shadow", /8px$/);
    await page.mouse.move(5, 100);
    await expect(surface).toHaveCSS("box-shadow", /8px$/);
    await caption.hover();
    await expect(surface).toHaveCSS("animation-name", "none");
    await page.screenshot({
      path: test.info().outputPath("selected-hover-shadow.png"),
    });
  });
}
