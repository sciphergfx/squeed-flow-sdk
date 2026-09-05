import { expect, test } from "@playwright/test";
import { centerOfNode, clearEvents, dragBetween, ready } from "./helpers";

test("draw mode connects nodes and creates a node in empty space", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.__flowTest.configure({ isEdgeHandlesEnabled: true }),
  );
  await expect(page.locator(".flow-sdk-canvas")).toHaveClass(/flow-sdk-draw/);
  await clearEvents(page);
  const source = await centerOfNode(page, "alpha");
  const target = await centerOfNode(page, "beta");
  await dragBetween(page, source, target);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "create-edge"),
    ),
  ).toEqual([
    { name: "create-edge", value: { source: "alpha", target: "beta" } },
  ]);
  await dragBetween(page, source, { x: source.x, y: source.y + 180 });
  const created = await page.evaluate(() =>
    window.__flowTest.events.filter((event) => event.name === "create-node"),
  );
  expect(created).toHaveLength(1);
  expect(created[0].value).toMatchObject({
    sourceNodeId: "alpha",
    type: "text",
    isArrayMode: false,
  });
  await expect(page.locator(".flow-sdk-ghost")).toHaveCount(0);
});

test("Escape cancels drawing and returning to the source creates nothing", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.__flowTest.configure({ isEdgeHandlesEnabled: true }),
  );
  await expect(page.locator(".flow-sdk-canvas")).toHaveClass(/flow-sdk-draw/);
  await clearEvents(page);
  const source = await centerOfNode(page, "alpha");
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x, source.y + 160, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".flow-sdk-ghost")).toHaveCount(0);
  await dragBetween(
    page,
    { x: source.x - 35, y: source.y },
    { x: source.x + 35, y: source.y },
  );
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) =>
        event.name.startsWith("create-"),
      ),
    ),
  ).toEqual([]);
});

test("node handles can draw while selection mode is active", async ({
  page,
}) => {
  await ready(page);
  const node = page.locator('.flow-sdk-node[data-node-id="alpha"]');
  await node.hover();
  const handle = node.getByRole("button", { name: "Draw edge", exact: true });
  await expect(handle).toBeVisible();
  const bounds = await handle.boundingBox();
  await clearEvents(page);
  await dragBetween(
    page,
    { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 },
    await centerOfNode(page, "beta"),
  );
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "create-edge"),
    ),
  ).toHaveLength(1);
});

test("pan and wheel zoom work without selection side effects", async ({
  page,
}) => {
  await ready(page);
  await clearEvents(page);
  const before = await page.evaluate(() => window.__flowTest.engine!.pan());
  await dragBetween(page, { x: 50, y: 100 }, { x: 130, y: 140 });
  const after = await page.evaluate(() => window.__flowTest.engine!.pan());
  expect(after.x - before.x).toBeCloseTo(80, 1);
  expect(after.y - before.y).toBeCloseTo(40, 1);
  const zoom = await page.evaluate(() => window.__flowTest.engine!.zoom());
  await page.mouse.wheel(0, -100);
  await expect
    .poll(() => page.evaluate(() => window.__flowTest.engine!.zoom()))
    .toBeGreaterThan(zoom);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name.includes("select")),
    ),
  ).toEqual([]);
});

test.describe("touch", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test("two-finger pinch changes zoom and preserves its model anchor", async ({
    page,
    context,
  }, testInfo) => {
    await ready(page);
    const before = await page.evaluate(() => ({
      zoom: window.__flowTest.engine!.zoom(),
      anchor: window.__flowTest.engine!.clientToModel(195, 180),
    }));
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: 155, y: 180, id: 1 },
        { x: 235, y: 180, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: 115, y: 180, id: 1 },
        { x: 275, y: 180, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => page.evaluate(() => window.__flowTest.engine!.zoom()))
      .toBeGreaterThan(before.zoom * 1.8);
    const after = await page.evaluate(() =>
      window.__flowTest.engine!.clientToModel(195, 180),
    );
    expect(after.x).toBeCloseTo(before.anchor.x, 1);
    expect(after.y).toBeCloseTo(before.anchor.y, 1);
    await page.screenshot({ path: testInfo.outputPath("mobile.png") });
  });
});
