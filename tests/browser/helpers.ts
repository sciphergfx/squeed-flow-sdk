import { expect, type Page } from "@playwright/test";
import type {} from "./fixture/main";

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
