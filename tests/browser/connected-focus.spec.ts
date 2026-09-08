import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("selecting the same connected group preserves the viewport", async ({
  page,
}) => {
  await ready(page, "custom=1");
  await page.evaluate(() => {
    window.__flowTest.configure({ compactPropertyLayout: true });
    window.__flowTest.replaceGraph({
      nodes: ["alpha", "beta"].map((id) => ({ data: { id, type: "text" } })),
      edges: [{ data: { id: "link", source: "alpha", target: "beta" } }],
    });
  });
  await expect(page.locator(".flow-sdk-node")).toHaveCount(2);
  await page.evaluate(() => {
    window.__flowTest.events.length = 0;
    window.__flowTest.engine!.isolateConnections("alpha", 60, false);
  });
  await page.waitForFunction(() =>
    window.__flowTest.events.some((event) => event.name === "layout-complete"),
  );
  const viewport = await page.evaluate(() => {
    const engine = window.__flowTest.engine!;
    engine.zoom(0.75);
    engine.pan({ x: 23, y: 41 });
    return { zoom: engine.zoom(), pan: engine.pan() };
  });
  await page.evaluate(() => {
    window.__flowTest.engine!.isolateConnections("beta", 60, false);
    window.__flowTest.engine!.isolateConnections("beta", 60, false);
  });
  await page.waitForTimeout(1500);
  expect(
    await page.evaluate(() => ({
      zoom: window.__flowTest.engine!.zoom(),
      pan: window.__flowTest.engine!.pan(),
    })),
  ).toEqual(viewport);
});
