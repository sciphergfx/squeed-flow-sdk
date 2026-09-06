import { expect, test, type Locator, type Page } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

async function expectFit(
  page: Page,
  target: Locator,
  padding: number,
  width: number,
) {
  await expect
    .poll(async () => {
      const box = await target.boundingBox();
      if (!box) return false;
      return (
        Math.abs(box.x + box.width / 2 - width / 2) < 2 &&
        Math.abs(box.y + box.height / 2 - 475) < 2 &&
        box.x >= padding - 2 &&
        box.y >= padding - 2 &&
        box.x + box.width <= width - padding + 2 &&
        box.y + box.height <= 950 - padding + 2
      );
    })
    .toBe(true);
  expect(
    await page
      .locator(".flow-sdk-canvas")
      .evaluate((element) => [element.scrollLeft, element.scrollTop]),
  ).toEqual([0, 0]);
}

async function overview(page: Page) {
  const toolbar = page.getByRole("toolbar", {
    name: "Diagram controls",
    exact: true,
  });
  const close = toolbar.getByRole("button", {
    name: "Close selection tools",
    exact: true,
  });
  if (await close.isVisible()) await close.click();
  await toolbar
    .getByRole("button", { name: "Reset zoom", exact: true })
    .click();
}

for (const width of [1440, 390]) {
  for (const options of [undefined, { animate: false, padding: 140 }]) {
    test(`dot fits new views after layout (${width}px, ${options ? "custom" : "default"} options)`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/sdk-test/useSDKNodeFocus.tsx*", async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.has("original")) return route.continue();
        url.searchParams.set("original", "1");
        await route.fulfill({
          contentType: "application/javascript",
          body: `
          import { useSDKNodeFocus as original } from ${JSON.stringify(url.href)};
          export function useSDKNodeFocus(ref, scope, options) {
            const focus = original(ref, scope, ${options ? JSON.stringify(options) : "options"});
            return { ...focus, onLayoutComplete(engine) {
              const run = engine.focusNode;
              engine.focusNode = (...args) => { (window.__dotFocusCalls ??= []).push(args); return run(...args); };
              try { return focus.onLayoutComplete(engine); } finally { engine.focusNode = run; }
            } };
          }
        `,
        });
      });
      await page.setViewportSize({ width, height: 950 });
      await page.goto(process.env.SDK_TEST_URL!);
      await chooseToolbarOption(
        page.getByRole("combobox", { name: "Control examples", exact: true }),
        "Parent",
      );
      await chooseToolbarOption(
        page.getByRole("combobox", { name: "Parent style", exact: true }),
        "Default",
      );
      await page.getByTestId("json-toggle").click();
      const editor = page.getByRole("textbox", {
        name: "JSON JSON",
        exact: true,
      });
      const document = {
        object: { $label: "Object", value: "A plain object value" },
        article: {
          $label: "Article",
          $content: "# Article\n\n" + "A longer description. ".repeat(30),
          value: "A property value",
        },
        group: { $label: "Tools", $icon: "PiStack", $collapsed: false },
        first: { $parent: "root.group", $label: "First tool", name: "first" },
        second: {
          $parent: "root.group",
          $label: "Second tool",
          name: "second",
        },
      };
      await editor.fill(JSON.stringify(document));
      await page.getByTestId("json-toggle").click();
      const padding = options?.padding ?? 90;
      const animate = options?.animate ?? true;
      const node = (id: string) =>
        page.locator(`.flow-sdk-node[data-node-id="root.${id}"]`);
      const calls = () =>
        page.evaluate(() => (window as any).__dotFocusCalls ?? []);
      let count = 0;
      const switchView = async (
        button: Locator,
        target: Locator,
        id: string,
      ) => {
        await button.click();
        count++;
        await expect.poll(calls).toHaveLength(count);
        expect((await calls()).at(-1)).toEqual([
          `root.${id}`,
          padding,
          animate,
        ]);
        await expectFit(page, target, padding, width);
      };
      await node("object").locator("[data-flow-node-surface]").click();
      await switchView(
        node("object").getByRole("button", { name: "Show icon", exact: true }),
        node("object"),
        "object",
      );
      await expect(
        node("object").locator("[data-flow-icon-label]"),
      ).toHaveCount(1);
      await switchView(
        node("object").getByRole("button", {
          name: "Show properties",
          exact: true,
        }),
        node("object"),
        "object",
      );
      await expect(
        node("object").locator('[data-flow-property="value"]'),
      ).toHaveCount(1);
      await overview(page);
      await node("article").locator("[data-flow-node-surface]").click();
      await switchView(
        node("article").getByRole("button", {
          name: "Show properties",
          exact: true,
        }),
        node("article"),
        "article",
      );
      await switchView(
        node("article").getByRole("button", {
          name: "Show content",
          exact: true,
        }),
        node("article"),
        "article",
      );
      await expect(
        node("article").locator("[data-flow-content]"),
      ).toContainText("A longer description.");
      await overview(page);
      const label = page.locator(
        '.flow-sdk-container-label[data-node-id="root.group"]',
      );
      const container = page.locator(
        '.flow-sdk-container[data-node-id="root.group"]',
      );
      await label.locator("text").click();
      await switchView(
        label.getByRole("button", { name: "Show icon", exact: true }),
        node("group"),
        "group",
      );
      await expect(container).toHaveCount(0);
      await switchView(
        node("group").getByRole("button", { name: "Show parent", exact: true }),
        container,
        "group",
      );
      await expect(node("first")).toBeVisible();
      await expect(node("second")).toBeVisible();
      await page.screenshot({
        path: test.info().outputPath("parent-fitted.png"),
      });
      await page.getByTestId("json-toggle").click();
      expect(JSON.parse(await editor.inputValue())).toEqual(document);
      expect(errors).toEqual([]);
    });
  }
}
