import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  for (const compact of [true, false]) {
    for (const nested of [true, false]) {
      test(`parent isolation survives repeated view toggles (${width}px, compact=${compact}, nested=${nested})`, async ({
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
            export function useSDKNodeFocus(...args) { window.__focusRef = args[0]; return original(...args); }
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
        await chooseToolbarOption(
          page.getByRole("combobox", { name: "Control examples", exact: true }),
          "Layout",
        );
        const panel = page.getByRole("region", {
          name: "SDK control examples",
          exact: true,
        });
        const pill = panel.getByRole("button", {
          name: "Compact property layout",
          exact: true,
        });
        if ((await pill.getAttribute("aria-pressed")) !== String(compact))
          await pill.click();
        await panel
          .getByRole("button", { name: "Close selection tools", exact: true })
          .click();
        const childId = nested ? "root.group.child" : "root.child";
        const child = {
          $label: "Child",
          $parent: "root.group",
          $target: "root.linked",
          value: "Preserved",
        };
        const document = {
          $label: "Parent isolation",
          group: {
            $label: "Group",
            $collapsed: true,
            ...(nested ? { child } : {}),
          },
          ...(!nested ? { child } : {}),
          linked: { $label: "Linked", value: "External" },
          unrelated: { $label: "Unrelated", value: "Hidden" },
        };
        await page.getByTestId("json-toggle").click();
        const editor = page.getByRole("textbox", {
          name: "JSON JSON",
          exact: true,
        });
        await editor.fill(JSON.stringify(document));
        await page.getByTestId("json-toggle").click();
        const icon = page.locator('.flow-sdk-node[data-node-id="root.group"]');
        const container = page.locator(
          '.flow-sdk-container[data-node-id="root.group"]',
        );
        const label = page.locator(
          '.flow-sdk-container-label[data-node-id="root.group"]',
        );
        const childNode = page.locator(
          `.flow-sdk-node[data-node-id="${childId}"]:visible`,
        );
        await expect(icon).toBeVisible();
        await page.locator(".flow-sdk-canvas").screenshot();
        const viewport = () =>
          page.evaluate(() => {
            const engine = (window as any).__focusRef.current;
            return { pan: engine.pan(), zoom: engine.zoom() };
          });
        const originalViewport = await viewport();
        await icon
          .locator("[data-flow-node-surface]")
          .click({ modifiers: ["Shift"] });
        await expect(
          page.locator('.flow-sdk-node[data-node-id="root.unrelated"]'),
        ).toBeHidden();
        for (let cycle = 0; cycle < 3; cycle++) {
          await icon
            .getByRole("button", { name: "Show parent", exact: true })
            .click();
          await expect(container).toBeVisible();
          await expect(childNode).toHaveCount(1);
          await expect(
            page.locator('.flow-sdk-node[data-node-id="root.linked"]'),
          ).toBeVisible();
          await expect(
            page.locator(
              `.flow-sdk-edge[data-edge-id="${childId}->root.linked"]`,
            ),
          ).toBeVisible();
          await expect(
            page.locator('.flow-sdk-node[data-node-id="root.unrelated"]'),
          ).toBeHidden();
          const labelOffset = await label
            .locator("foreignObject")
            .evaluate((element) => {
              const toggle = element as SVGForeignObjectElement;
              const background = element.parentElement!.querySelector(
                "rect",
              ) as SVGRectElement;
              return {
                gap:
                  toggle.x.baseVal.value -
                  background.x.baseVal.value -
                  background.width.baseVal.value,
                center:
                  toggle.y.baseVal.value +
                  toggle.height.baseVal.value / 2 -
                  background.y.baseVal.value -
                  background.height.baseVal.value / 2,
              };
            });
          expect(labelOffset.gap).toBeCloseTo(8, 3);
          expect(labelOffset.center).toBeCloseTo(0, 3);
          if (cycle < 2) {
            await label
              .getByRole("button", { name: "Show icon", exact: true })
              .click();
            await expect(container).toHaveCount(0);
            await expect(childNode).toHaveCount(0);
            await expect(
              icon.locator("[data-flow-inspection-row]"),
            ).toHaveCount(0);
          }
        }
        await page.screenshot({
          path: test.info().outputPath("parent-expanded-isolated.png"),
        });
        const background = await page
          .locator(".flow-sdk-canvas")
          .evaluate((canvas) => {
            const bounds = canvas.getBoundingClientRect();
            for (let offsetY = 8; offsetY < bounds.height; offsetY += 16) {
              for (let offsetX = 8; offsetX < bounds.width; offsetX += 16) {
                const point = { x: bounds.x + offsetX, y: bounds.y + offsetY };
                const hit = document.elementFromPoint(point.x, point.y);
                if (hit === canvas || hit?.matches("svg.flow-sdk-svg"))
                  return point;
              }
            }
            throw new Error("No empty canvas point available");
          });
        await page.mouse.click(background.x, background.y);
        await expect(
          page.locator('.flow-sdk-node[data-node-id="root.unrelated"]'),
        ).toBeVisible();
        await expect.poll(viewport).toEqual(originalViewport);
        await page.getByTestId("json-toggle").click();
        expect(JSON.parse(await editor.inputValue())).toEqual({
          ...document,
          group: { ...document.group, $collapsed: false },
        });
        expect(errors).toEqual([]);
      });
    }
  }
}
