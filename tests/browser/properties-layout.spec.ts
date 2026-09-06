import { expect, test, type Page } from "@playwright/test";
import { ready } from "./helpers";

async function configure(
  page: Page,
  config: { edgeMode?: "auto" | "properties"; compactPropertyLayout?: boolean },
) {
  await page.evaluate((config) => {
    window.__flowTest.events.length = 0;
    window.__flowTest.configure(config);
  }, config);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__flowTest.events.some(
          (event) => event.name === "layout-complete",
        ),
      ),
    )
    .toBe(true);
}

for (const width of [1440, 390]) {
  test(`isolated layout compaction is opt-in and restoration restores positions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=connections");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__flowTest.events.some(
            (event) => event.name === "layout-complete",
          ),
        ),
      )
      .toBe(true);
    const boxes = () =>
      page.evaluate(() =>
        ["root", "root.alpha", "root.beta", "root.gamma"].map(
          (id) => window.__flowTest.engine!.getNodeBox(id) ?? null,
        ),
      );
    const original = await boxes();
    const document = await page.evaluate(() => window.__flowTest.document);
    await page.evaluate(() =>
      window.__flowTest.engine!.isolateConnections("root.alpha", 70, false),
    );
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.gamma"]'),
    ).toBeHidden();
    expect(await boxes()).toEqual(original);
    await configure(page, { compactPropertyLayout: true });
    expect((await boxes())[3]).toBeNull();
    expect((await boxes()).slice(0, 3)).not.toEqual(original.slice(0, 3));
    await page.evaluate(() => {
      window.__flowTest.events.length = 0;
      window.__flowTest.engine!.restoreView(false);
      window.__flowTest.engine!.centerAndFit(70, false);
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__flowTest.events.some(
            (event) => event.name === "layout-complete",
          ),
        ),
      )
      .toBe(true);
    expect(await boxes()).toEqual(original);
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.gamma"]'),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      document,
    );
  });

  test(`property layout compaction is disabled by default and reversible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=connections");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__flowTest.events.some(
            (event) => event.name === "layout-complete",
          ),
        ),
      )
      .toBe(true);
    const boxes = () =>
      page.evaluate(() =>
        ["root", "root.alpha", "root.beta", "root.gamma"].map(
          (id) => window.__flowTest.engine!.getNodeBox(id) ?? null,
        ),
      );
    const original = await boxes();
    const document = await page.evaluate(() => window.__flowTest.document);
    await configure(page, { edgeMode: "properties" });
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root"]'),
    ).toBeHidden();
    expect(await boxes()).toEqual(original);
    await configure(page, { compactPropertyLayout: true });
    const compact = await boxes();
    expect(compact[0]).toBeNull();
    expect(compact.slice(1)).not.toEqual(original.slice(1));
    await expect(page.locator(".flow-sdk-edge")).toHaveCount(2);
    await configure(page, { compactPropertyLayout: false });
    expect(await boxes()).toEqual(original);
    await configure(page, { edgeMode: "auto", compactPropertyLayout: true });
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root"]'),
    ).toBeVisible();
    expect(await boxes()).toEqual(original);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      document,
    );
    await page.screenshot({
      path: test.info().outputPath("restored-layout.png"),
    });
  });
}
