import { expect, test } from "@playwright/test";
import { clearEvents, dragBetween, ready } from "./helpers";

test("JSON edits persist labels, colors, icons and collapse state", async ({
  page,
}, testInfo) => {
  await ready(page, "?graph=json");
  const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
  await node.click();
  const label = page.getByRole("textbox", { name: "Node label", exact: true });
  await label.fill("Renamed Alpha");
  await label.press("Enter");
  await expect(node).toContainText("Renamed Alpha");
  await page
    .getByRole("button", { name: "Background green.500", exact: true })
    .click();
  const originalIconCount = await node.locator("svg").count();
  const icon = page.getByRole("textbox", { name: "Node icon", exact: true });
  await icon.fill("PiGear");
  await icon.press("Enter");
  await expect(node.locator("svg")).toHaveCount(originalIconCount + 1);
  await page
    .getByRole("button", { name: "Collapse node", exact: true })
    .click();
  await expect(
    page.locator('.flow-sdk-node[data-node-id="root.alpha.child"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Expand node", exact: true }).click();
  await expect(
    page.locator('.flow-sdk-node[data-node-id="root.alpha.child"]'),
  ).toHaveCount(1);
  expect(
    await page.evaluate(() => window.__flowTest.document.alpha),
  ).toMatchObject({
    $label: "Renamed Alpha",
    $bgColor: "green.500",
    $icon: "PiGear",
  });
  await page.screenshot({ path: testInfo.outputPath("document-desktop.png") });
});

test("multi-selection colors and deletes every selected JSON node", async ({
  page,
}) => {
  await ready(page, "?graph=json");
  await page.evaluate(() =>
    window.__flowTest.configure({ isMultiSelectMode: true }),
  );
  await page.locator('.flow-sdk-node[data-node-id="root.alpha"]').click();
  await page.locator('.flow-sdk-node[data-node-id="root.beta"]').click();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Background red.500", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => [
        window.__flowTest.document.alpha.$bgColor,
        window.__flowTest.document.beta.$bgColor,
      ]),
    )
    .toEqual(["red.500", "red.500"]);
  await page.keyboard.press("Delete");
  await expect(
    page.locator(
      '.flow-sdk-node[data-node-id="root.alpha"], .flow-sdk-node[data-node-id="root.beta"]',
    ),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => Object.keys(window.__flowTest.document)),
  ).toContain("gamma");
});

test("box selection includes nodes without triggering pan", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.__flowTest.configure({ isMultiSelectMode: true }),
  );
  const bounds = await page.locator(".flow-sdk-nodes").evaluate((layer) => {
    const rectangles = [...layer.querySelectorAll(".flow-sdk-node")].map(
      (node) => node.getBoundingClientRect(),
    );
    return {
      left: Math.min(...rectangles.map((rect) => rect.left)),
      right: Math.max(...rectangles.map((rect) => rect.right)),
      top: Math.min(...rectangles.map((rect) => rect.top)),
      bottom: Math.max(...rectangles.map((rect) => rect.bottom)),
    };
  });
  const pan = await page.evaluate(() => window.__flowTest.engine!.pan());
  await dragBetween(
    page,
    { x: bounds.left - 10, y: bounds.top - 10 },
    { x: bounds.right + 10, y: bounds.bottom + 10 },
  );
  await expect(page.getByText("3 selected", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__flowTest.engine!.pan())).toEqual(
    pan,
  );
});

test("unmount stops viewport notifications and remount renders cleanly", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => window.__flowTest.mount(false));
  await expect(page.locator(".flow-sdk-canvas")).toHaveCount(0);
  await clearEvents(page);
  await page.evaluate(() => window.__flowTest.engine!.pan({ x: 17, y: 23 }));
  expect(await page.evaluate(() => window.__flowTest.events)).toEqual([]);
  await page.evaluate(() => window.__flowTest.mount(true));
  await expect(page.locator(".flow-sdk-edge")).toHaveCount(2);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "remove-edge"),
    ),
  ).toEqual([]);
});
