import { expect, test } from "@playwright/test";
import { clearEvents, ready } from "./helpers";

test("viewport notifications contain the latest frame state", async ({
  page,
}) => {
  await ready(page);
  await clearEvents(page);
  const expected = await page.evaluate(() => {
    const engine = window.__flowTest.engine!;
    engine.pan({ x: 10, y: 20 });
    engine.zoom(0.5);
    engine.pan({ x: 30, y: 40 });
    return { pan: engine.pan(), zoom: engine.zoom() };
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__flowTest.events
            .filter((event) => event.name === "viewport")
            .at(-1)?.value,
      ),
    )
    .toEqual(expected);
});

test("Strict Mode mount does not report deleted edges", async ({ page }) => {
  await ready(page);
  await expect(page.locator(".flow-sdk-edge")).toHaveCount(2);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "remove-edge"),
    ),
  ).toEqual([]);
});

test("node resize is observed after Strict Mode remount", async ({ page }) => {
  await ready(page, "?custom=1");
  const before = await page.evaluate(
    () => window.__flowTest.engine!.getNodeBox("alpha")!.w,
  );
  await page.evaluate(() => window.__flowTest.resizeNode(500));
  await expect
    .poll(() =>
      page.evaluate(() => window.__flowTest.engine!.getNodeBox("alpha")!.w),
    )
    .toBe(500);
  expect(before).toBe(200);
});

test("initialViewport survives initial layout", async ({ page }) => {
  await ready(page, "?viewport=1");
  expect(
    await page.evaluate(() => ({
      pan: window.__flowTest.engine!.pan(),
      zoom: window.__flowTest.engine!.zoom(),
    })),
  ).toEqual({ pan: { x: 25, y: 35 }, zoom: 0.25 });
});

test("readOnly blocks deletion and edge drawing", async ({ page }) => {
  await ready(page);
  await page.locator('.flow-sdk-node[data-node-id="alpha"]').click();
  await page.evaluate(() =>
    window.__flowTest.configure({ readOnly: true, isEdgeHandlesEnabled: true }),
  );
  await expect(
    page.getByRole("textbox", { name: "Node label", exact: true }),
  ).toHaveCount(0);
  await clearEvents(page);
  await page.keyboard.press("Delete");
  await expect(page.locator(".flow-sdk-node")).toHaveCount(3);
  const source = await page
    .locator('.flow-sdk-node[data-node-id="alpha"]')
    .boundingBox();
  const target = await page
    .locator('.flow-sdk-node[data-node-id="beta"]')
    .boundingBox();
  await page.mouse.move(
    source!.x + source!.width / 2,
    source!.y + source!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target!.x + target!.width / 2,
    target!.y + target!.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) =>
        ["delete-node", "create-edge", "create-node"].includes(event.name),
      ),
    ),
  ).toEqual([]);
});

test("node and edge selection switch and clear", async ({ page }) => {
  await ready(page);
  await page.locator('.flow-sdk-node[data-node-id="alpha"]').click();
  await expect(
    page.getByRole("textbox", { name: "Node label", exact: true }),
  ).toHaveValue("Alpha");
  await page.locator('.flow-sdk-edge[data-edge-id="alpha-beta"]').click();
  await expect(
    page.getByRole("textbox", { name: "Edge label", exact: true }),
  ).toHaveValue("First");
  await page.mouse.click(10, 10);
  await expect(
    page.getByRole("textbox", { name: "Edge label", exact: true }),
  ).toHaveCount(0);
});

test("deleting an edge reports its original data exactly once", async ({
  page,
}) => {
  await ready(page);
  await clearEvents(page);
  await page.locator('.flow-sdk-edge[data-edge-id="alpha-beta"]').click();
  await page.getByRole("button", { name: "Delete edge", exact: true }).click();
  await expect(page.locator(".flow-sdk-edge")).toHaveCount(1);
  const removed = await page.evaluate(() =>
    window.__flowTest.events.filter((event) => event.name === "remove-edge"),
  );
  expect(removed).toHaveLength(1);
  expect(removed[0].value).toMatchObject({
    id: "alpha-beta",
    data: { source: "alpha", target: "beta" },
  });
});

test("node labels commit once and Escape cancels", async ({ page }) => {
  await ready(page);
  await page.locator('.flow-sdk-node[data-node-id="alpha"]').click();
  const input = page.getByRole("textbox", { name: "Node label", exact: true });
  await clearEvents(page);
  await input.fill("Renamed");
  await input.press("Enter");
  await expect(
    page.locator('.flow-sdk-node[data-node-id="alpha"]'),
  ).toContainText("Renamed");
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "label"),
    ),
  ).toHaveLength(1);
  await input.fill("Cancelled");
  await input.press("Escape");
  await expect(input).toHaveValue("Renamed");
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "label"),
    ),
  ).toHaveLength(1);
});
