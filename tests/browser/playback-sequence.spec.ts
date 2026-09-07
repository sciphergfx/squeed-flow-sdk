import { expect, test, type Locator } from "@playwright/test";
import { ready } from "./helpers";

async function advance(mask: Locator, time: number) {
  await mask.evaluate((element, time) => { element.getAnimations()[0].currentTime = time; }, time);
}

for (const width of [1440, 390]) {
  test(`edge completes before the next node appears at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "custom=1");
    await page.evaluate(() => {
      window.__flowTest.configure({ edgeReveal: { durationMs: 1000, paused: true, revealNodes: true } });
      window.__flowTest.replaceGraph({
        nodes: ["start", "order", "finish"].map((id) => ({ data: { id, type: "text", label: id } })),
        edges: [
          { data: { id: "incoming", source: "start", target: "order" } },
          { data: { id: "outgoing", source: "order", target: "finish" } },
        ],
      });
    });
    const start = page.locator('[data-node-id="start"]');
    const order = page.locator('[data-node-id="order"]');
    const finish = page.locator('[data-node-id="finish"]');
    const incoming = page.locator('[data-edge-id="incoming"] .flow-sdk-edge-reveal');
    const outgoing = page.locator('[data-edge-id="outgoing"] .flow-sdk-edge-reveal');
    await expect(start).toBeVisible();
    await expect(order).toBeHidden();
    await expect(finish).toBeHidden();
    await expect(incoming).toBeAttached();
    await expect(outgoing).toHaveCount(0);
    await advance(incoming, 500);
    await expect(incoming).toHaveCSS("stroke-dashoffset", "50px");
    await expect(order).toBeHidden();
    await start.screenshot();
    await page.screenshot({ path: test.info().outputPath("edge-before-node.png") });
    await advance(incoming, 1000);
    await expect(order).toBeVisible();
    await expect(outgoing).toBeAttached();
    await expect(outgoing).toHaveCSS("stroke-dashoffset", "100px");
    await expect(finish).toBeHidden();
    await advance(outgoing, 999);
    await expect(finish).toBeHidden();
    await advance(outgoing, 1000);
    await expect(finish).toBeVisible();
    await page.evaluate(() => window.__flowTest.configure({ edgeReveal: undefined }));
    await expect(page.locator(".flow-sdk-node:visible")).toHaveCount(3);
  });
}

test("joins wait for every incoming edge and reversed edges reveal their actual target", async ({ page }) => {
  await ready(page, "custom=1");
  await page.evaluate(() => {
    window.__flowTest.configure({ edgeReveal: { durationMs: 1000, paused: true, revealNodes: true } });
    window.__flowTest.replaceGraph({
      nodes: ["left", "right", "join"].map((id) => ({ data: { id, type: "text" } })),
      edges: [
        { data: { id: "left-join", source: "left", target: "join" } },
        { data: { id: "reversed", source: "join", target: "right", isInverted: true } },
      ],
    });
  });
  await expect(page.locator('[data-node-id="left"]')).toBeVisible();
  await expect(page.locator('[data-node-id="right"]')).toBeVisible();
  const join = page.locator('[data-node-id="join"]');
  await expect(join).toBeHidden();
  await advance(page.locator('[data-edge-id="left-join"] .flow-sdk-edge-reveal'), 1000);
  await expect(join).toBeHidden();
  await advance(page.locator('[data-edge-id="reversed"] .flow-sdk-edge-reveal'), 1000);
  await expect(join).toBeVisible();
});

test("cycles and disconnected components finish under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, "custom=1");
  await page.evaluate(() => {
    window.__flowTest.configure({ edgeReveal: { durationMs: 1000, revealNodes: true } });
    window.__flowTest.replaceGraph({
      nodes: ["first", "second", "third", "fourth", "isolated"].map((id) => ({ data: { id, type: "text" } })),
      edges: [
        { data: { id: "one", source: "first", target: "second" } },
        { data: { id: "two", source: "second", target: "first" } },
        { data: { id: "three", source: "third", target: "fourth" } },
        { data: { id: "four", source: "fourth", target: "third" } },
        { data: { id: "self", source: "isolated", target: "isolated" } },
      ],
    });
  });
  await expect(page.locator(".flow-sdk-node:visible")).toHaveCount(5);
  await expect(page.locator(".flow-sdk-edge-reveal")).toHaveCount(5);
});