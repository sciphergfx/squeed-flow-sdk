import { chromium } from "@playwright/test";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
  });
  await page.goto(process.env.SDK_TEST_URL ?? "http://localhost:5174/sdk-test");
  const surface = page.locator(
    '.flow-sdk-node[data-node-id="review"] [data-flow-node-surface]',
  );
  await surface.waitFor();
  await surface.hover();
  await surface.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
  });
  const session = await page.context().newCDPSession(page);
  const events = [];
  session.on("Tracing.dataCollected", (chunk) => events.push(...chunk.value));
  for (const disabled of [false, true]) {
    await page.mouse.move(5, 100);
    const override = disabled
      ? await page.addStyleTag({
          content:
            "[data-flow-node-surface], [data-flow-node-surface]::before, [data-flow-node-surface]::after { animation: none !important; }",
        })
      : null;
    events.length = 0;
    await session.send("Tracing.start", {
      categories: "devtools.timeline",
      transferMode: "ReportEvents",
    });
    await surface.hover();
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const start = performance.now();
          const next = () =>
            performance.now() - start >= 2000
              ? resolve(null)
              : requestAnimationFrame(next);
          requestAnimationFrame(next);
        }),
    );
    const finished = new Promise((resolve) =>
      session.once("Tracing.tracingComplete", resolve),
    );
    await session.send("Tracing.end");
    await finished;
    const summary = {};
    for (const name of ["Paint", "Layout", "UpdateLayoutTree", "PrePaint"]) {
      const matches = events.filter(
        (event) => event.name === name && event.ph === "X",
      );
      summary[name] = {
        count: matches.length,
        ms:
          Math.round(
            matches.reduce((sum, event) => sum + (event.dur ?? 0), 0) / 100,
          ) / 10,
      };
    }
    console.log(
      JSON.stringify({ mode: disabled ? "disabled" : "animated", ...summary }),
    );
    await override?.evaluate((element) => element.remove());
  }
} finally {
  await browser.close();
}
