import { expect, type Page, type Locator } from "@playwright/test";
import type {} from "./fixture/main";

export async function chooseToolbarOption(trigger: Locator, option: string) {
  const name = await trigger.getAttribute("aria-label");
  await trigger.click();
  await trigger.page().getByRole("listbox", { name: name!, exact: true }).getByRole("option", { name: option, exact: true }).click();
}

export async function ready(page: Page, query = "") {
  await page.goto(`/${query}`);
  await page.waitForFunction(
    () =>
      window.__flowTest?.engine?.getNodeBox("alpha") ||
      window.__flowTest?.engine?.getNodeBox("root.alpha"),
  );
  await expect(page.locator('.flow-sdk-node[style*="hidden"]')).toHaveCount(0);
}

export async function clearEvents(page: Page) {
  await page.evaluate(() => {
    window.__flowTest.events.length = 0;
  });
}

export async function expectScrollableToolbar(page: Page) {
  const panel = page.locator("[data-flow-toolbar-scroll]");
  await expect(panel).toHaveCSS("height", "50px");
  await expect(panel).toHaveCSS("overflow-x", "auto");
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  for (const button of await panel.getByRole("button").all()) {
    await button.scrollIntoViewIfNeeded();
    const rect = await button.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(
      bounds!.x + bounds!.width,
    );
    expect(rect!.y).toBeGreaterThanOrEqual(bounds!.y);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(
      bounds!.y + bounds!.height,
    );
  }
  await panel.evaluate((element) => {
    element.scrollLeft = 0;
  });
}

export async function centerOfNode(page: Page, id: string) {
  return page.evaluate((id) => {
    const engine = window.__flowTest.engine!;
    return engine.modelToClient(engine.getNodeBox(id)!);
  }, id);
}

export async function dragBetween(
  page: Page,
  source: { x: number; y: number },
  target: { x: number; y: number },
) {
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
}
