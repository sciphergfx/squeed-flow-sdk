import { expect, test } from "@playwright/test";
import { clearEvents, expectScrollableToolbar, ready } from "./helpers";

test("animation toggles mixed selections and respects read-only and reduced motion", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() => {
    const current = window.__flowTest.document;
    window.__flowTest.replaceDocument({
      ...current,
      alpha: { ...current.alpha, $isNodeAnimated: true },
    });
    window.__flowTest.configure({ isMultiSelectMode: true });
  });
  await page
    .locator('.flow-sdk-node[data-node-id="root.alpha"] p[title]')
    .click();
  await page
    .locator('.flow-sdk-node[data-node-id="root.beta"] p[title]')
    .click();
  const toggle = page.getByRole("button", {
    name: "Toggle node animation",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-pressed", "mixed");
  await toggle.click();
  await expect(page.locator(".flow-sdk-node-border-animation")).toHaveCount(2);
  expect(
    await page.evaluate(() => [
      window.__flowTest.document.alpha.$isNodeAnimated,
      window.__flowTest.document.beta.$isNodeAnimated,
    ]),
  ).toEqual([true, true]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.locator(".flow-sdk-node-border-animation").first(),
  ).toHaveCSS("animation-name", "none");
  await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
  await expect(toggle).toHaveCount(0);
  await expect(page.locator(".flow-sdk-node-border-animation")).toHaveCount(2);
  await page.evaluate(() =>
    window.__flowTest.configure({
      readOnly: false,
      selectionToolbar: { hide: ["animation"] },
    }),
  );
  await expect(toggle).toHaveCount(0);
});

test("compound nodes animate the container once and remain selectable", async ({
  page,
}, testInfo) => {
  await ready(page);
  await page.evaluate(() =>
    window.__flowTest.replaceGraph({
      nodes: [
        {
          data: {
            id: "group",
            type: "objectView",
            label: "Animated group",
            isNodeAnimated: true,
            viewProps: { outline: true, borderRadius: 30 },
          },
        },
        {
          data: { id: "alpha", type: "text", label: "Child", parent: "group" },
        },
      ],
      edges: [],
    }),
  );
  const group = page.locator('.flow-sdk-container[data-node-id="group"]');
  const animation = group.locator(".flow-sdk-node-border-animation");
  await expect(animation).toHaveCount(1);
  await expect(
    page.locator(
      '.flow-sdk-node[data-node-id="group"] .flow-sdk-node-animation',
    ),
  ).toHaveCount(0);
  const geometry = await group.evaluate((element) => {
    const [base, border] = element.querySelectorAll<SVGRectElement>("rect");
    return [base, border].map((rect) => [
      rect.x.baseVal.value,
      rect.y.baseVal.value,
      rect.width.baseVal.value,
      rect.height.baseVal.value,
    ]);
  });
  expect(geometry[1]).toEqual(geometry[0]);
  const before = await animation.evaluate(
    (element) => getComputedStyle(element).strokeDashoffset,
  );
  await expect
    .poll(() =>
      animation.evaluate(
        (element) => getComputedStyle(element).strokeDashoffset,
      ),
    )
    .not.toBe(before);
  await group.locator("text").click();
  await page.screenshot({
    path: testInfo.outputPath("container-animation.png"),
  });
  await page
    .getByRole("button", { name: "Toggle node animation", exact: true })
    .click();
  await expect(animation).toHaveCount(0);
});

test("large-graph performance mode suppresses node animation without changing data", async ({
  page,
}) => {
  await ready(page, "?custom=1");
  await page.evaluate(() =>
    window.__flowTest.replaceGraph({
      nodes: Array.from({ length: 201 }, (_, index) => ({
        data: {
          id: index === 0 ? "alpha" : `node-${index}`,
          type: "text",
          label: `Node ${index}`,
          isNodeAnimated: true,
        },
      })),
      edges: [],
    }),
  );
  await expect(page.locator(".flow-sdk-canvas")).toHaveClass(/flow-sdk-perf/);
  await expect(page.locator(".flow-sdk-node")).toHaveCount(201);
  await expect(page.locator(".flow-sdk-node-border-animation")).toHaveCount(0);
});

test.describe("mobile content animation", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("Runbook remains editable and its animation control fits", async ({
    page,
  }, testInfo) => {
    await ready(page, "?graph=json");
    await page.evaluate(() =>
      window.__flowTest.replaceDocument({
        runbook: { $label: "Runbook", $content: "First\nSecond" },
      }),
    );
    const node = page.locator('.flow-sdk-node[data-node-id="root.runbook"]');
    await node.locator("p[title]").tap();
    const toggle = page.getByRole("button", {
      name: "Toggle node animation",
      exact: true,
    });
    await toggle.tap();
    const border = node.locator(".flow-sdk-node-border-animation");
    await expect(border).toHaveCount(1);
    const offset = await border.evaluate(
      (element) => getComputedStyle(element).strokeDashoffset,
    );
    await expect
      .poll(() =>
        border.evaluate(
          (element) => getComputedStyle(element).strokeDashoffset,
        ),
      )
      .not.toBe(offset);
    await node.locator("[data-flow-content]").dblclick();
    const input = node.getByRole("textbox", {
      name: "Node content",
      exact: true,
    });
    await input.fill("Mobile\nContent");
    await input.press("ControlOrMeta+Enter");
    await expect(node.locator("[data-flow-content]")).toHaveText(
      "Mobile\nContent",
    );
    await expectScrollableToolbar(page);
    await page.screenshot({
      path: testInfo.outputPath("runbook-animation-mobile.png"),
    });
  });
});

for (const type of ["text", "arrayView", "objectView"] as const) {
  test(`${type} border circulates without moving, resizing or blocking editing`, async ({
    page,
  }, testInfo) => {
    await ready(page);
    await page.evaluate(
      (type) =>
        window.__flowTest.replaceGraph({
          nodes: [
            {
              data: {
                id: "alpha",
                type,
                label: "Animated node",
                headerTitle: "Animated node",
                description: { status: "ready" },
                viewProps: { borderRadius: 24 },
              },
            },
          ],
          edges: [],
        }),
      type,
    );
    const node = page.locator('.flow-sdk-node[data-node-id="alpha"]');
    await expect(node.locator("p[title]")).toHaveText("Animated node");
    await node.click();
    const before = await node.evaluate((element: HTMLElement) => ({
      width: element.offsetWidth,
      height: element.offsetHeight,
    }));
    await page
      .getByRole("button", { name: "Toggle node animation", exact: true })
      .click();
    const border = node.locator(".flow-sdk-node-border-animation");
    await expect(border).toHaveAttribute("pathLength", "100");
    await expect(border).toHaveAttribute("stroke-dasharray", "18 82");
    await expect(border).toHaveAttribute("rx", "20");
    const offset = await border.evaluate(
      (element) => getComputedStyle(element).strokeDashoffset,
    );
    await expect
      .poll(() =>
        border.evaluate(
          (element) => getComputedStyle(element).strokeDashoffset,
        ),
      )
      .not.toBe(offset);
    expect(
      await node.evaluate((element: HTMLElement) => ({
        width: element.offsetWidth,
        height: element.offsetHeight,
      })),
    ).toEqual(before);
    const rect = await border.evaluate((element: SVGRectElement) => ({
      width: element.width.baseVal.value,
      height: element.height.baseVal.value,
    }));
    expect(rect).toEqual({
      width: before.width - 8,
      height: before.height - 8,
    });
    await node.locator("p[title]").dblclick();
    const editor = node.getByRole("textbox");
    await editor.fill("Still editable");
    await editor.press("Enter");
    await expect(node.locator("p[title]")).toHaveText("Still editable");
    await page.screenshot({
      path: testInfo.outputPath(`${type}-animation.png`),
    });
    await page
      .getByRole("button", { name: "Toggle node animation", exact: true })
      .click();
    await expect(border).toHaveCount(0);
  });
}

test("Runbook animation persists in JSON and follows edited content bounds", async ({
  page,
}) => {
  await ready(page, "?graph=json");
  await page.evaluate(() =>
    window.__flowTest.replaceDocument({
      runbook: { $label: "Runbook", $content: "First", $outline: true },
    }),
  );
  const node = page.locator('.flow-sdk-node[data-node-id="root.runbook"]');
  await node.locator("p[title]").click();
  await clearEvents(page);
  const toggle = page.getByRole("button", {
    name: "Toggle node animation",
    exact: true,
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.__flowTest.document.runbook)).toEqual(
    {
      $label: "Runbook",
      $content: "First",
      $outline: true,
      $isNodeAnimated: true,
    },
  );
  await node.locator("[data-flow-content]").dblclick();
  const input = node.getByRole("textbox", {
    name: "Node content",
    exact: true,
  });
  await input.fill("First\nSecond\nThird\nFourth");
  await input.press("ControlOrMeta+Enter");
  await expect
    .poll(() =>
      node.evaluate((element: HTMLElement) => {
        const border = element.querySelector<SVGRectElement>(
          ".flow-sdk-node-border-animation",
        )!;
        return Math.abs(border.height.baseVal.value + 8 - element.offsetHeight);
      }),
    )
    .toBeLessThan(1);
  await toggle.click();
  await expect(node.locator(".flow-sdk-node-border-animation")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => window.__flowTest.document.runbook.$isNodeAnimated,
    ),
  ).toBe(false);
});
