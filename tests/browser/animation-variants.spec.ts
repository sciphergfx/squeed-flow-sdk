import { expect, test, type Locator } from "@playwright/test";
import { chooseToolbarOption, ready } from "./helpers";

async function expectMotion(
  element: Locator,
  property: "opacity" | "strokeDashoffset",
) {
  const initial = await element.evaluate(
    (node, property) => getComputedStyle(node)[property],
    property,
  );
  await expect
    .poll(() =>
      element.evaluate(
        (node, property) => getComputedStyle(node)[property],
        property,
      ),
    )
    .not.toBe(initial);
}

for (const width of [1440, 390]) {
  test(`node Trace and Pulse persist and selectors follow the enabled icon at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=connections");
    const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    await node.locator("[data-flow-node-surface]").click();
    const button = page.getByRole("button", {
      name: "Toggle node animation",
      exact: true,
    });
    const selector = page.getByRole("combobox", {
      name: "Node animation",
      exact: true,
    });
    await expect(selector).toHaveCount(0);
    await button.click();
    await expect(selector).toContainText("Trace");
    expect(
      await selector.evaluate((element) =>
        element.previousElementSibling?.getAttribute("aria-label"),
      ),
    ).toBe("Toggle node animation");
    const border = node.locator(".flow-sdk-node-border-animation");
    await expect(border).toHaveAttribute("stroke-dasharray", "18 82");
    await expectMotion(border, "strokeDashoffset");
    await chooseToolbarOption(selector, "Pulse");
    await expect(border).toHaveAttribute("data-animation-variant", "pulse");
    expect(await border.getAttribute("stroke-dasharray")).toBeNull();
    await expect(border).toHaveCSS("animation-name", "flow-sdk-node-pulse");
    await expectMotion(border, "opacity");
    expect(
      await page.evaluate(
        () => window.__flowTest.document.alpha.$nodeAnimationVariant,
      ),
    ).toBe("pulse");
    await button.click();
    await expect(selector).toHaveCount(0);
    await expect(border).toHaveCount(0);
    await button.click();
    await expect(selector).toContainText("Pulse");
    await expect(border).toHaveAttribute("data-animation-variant", "pulse");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(border).toHaveCSS("animation-name", "none");
    await chooseToolbarOption(selector, "Trace");
    await expect(border).toHaveCSS("animation-name", "none");
    await selector.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath("node-animation-selector.png"),
    });
    await page.evaluate(() =>
      window.__flowTest.configure({
        selectionToolbar: { hide: ["animation"] },
      }),
    );
    await expect(button).toHaveCount(0);
    await expect(selector).toHaveCount(0);
  });

  test(`edge Dash and Trace share paths and retain their variant at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=connections");
    await page.evaluate(() =>
      window.__flowTest.replaceDocument({
        alpha: {
          value: "Source",
          $connections: [
            {
              id: "link",
              target: "root.beta",
              sourceProperty: "value",
              targetProperty: "value",
              label: "Mapping",
              color: "teal.500",
            },
          ],
        },
        beta: { value: "Target" },
      }),
    );
    const edge = page.locator('.flow-sdk-edge[data-source-property="value"]');
    await expect(edge).toHaveCount(1);
    await page
      .locator('.flow-sdk-edge-label[data-source-property="value"]')
      .click();
    const selector = page.getByRole("combobox", {
      name: "Edge animation",
      exact: true,
    });
    await expect(selector).toHaveCount(0);
    await page
      .getByRole("button", { name: "Edge style animated", exact: true })
      .click();
    await expect(selector).toContainText("Dash");
    expect(
      await selector.evaluate((element) =>
        element.previousElementSibling?.getAttribute("aria-label"),
      ),
    ).toBe("Edge style animated");
    await expectMotion(edge.locator(".flow-sdk-edge-anim"), "strokeDashoffset");
    const originalPath = await edge.locator("path").first().getAttribute("d");
    await chooseToolbarOption(selector, "Trace");
    const trace = edge.locator(".flow-sdk-edge-trace");
    await expect(trace).toHaveAttribute("d", originalPath!);
    await expect(trace).toHaveAttribute("stroke-dasharray", "18 100");
    await expect(trace).toHaveCSS("pointer-events", "none");
    await expectMotion(trace, "strokeDashoffset");
    await expect(edge.locator(".flow-sdk-edge-hit")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => window.__flowTest.document.alpha.$connections[0],
      ),
    ).toMatchObject({
      animationVariant: "traveling",
      style: "animated",
      color: "teal.500",
      label: "Mapping",
    });
    await page
      .getByRole("button", { name: "Edge style solid", exact: true })
      .click();
    await expect(selector).toHaveCount(0);
    await expect(trace).toHaveCount(0);
    await page
      .getByRole("button", { name: "Edge style animated", exact: true })
      .click();
    await expect(selector).toContainText("Trace");
    await expect(trace).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(trace).toHaveCSS("animation-name", "none");
    await chooseToolbarOption(selector, "Dash");
    await expect(trace).toHaveCount(0);
    await expect(edge.locator(".flow-sdk-edge-anim")).toHaveCSS(
      "animation-name",
      "none",
    );
    await selector.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath("edge-animation-selector.png"),
    });
  });
}

test("parent pulse, reversed edge trace, and mixed node variants", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() =>
    window.__flowTest.replaceDocument({
      group: {
        $label: "Tools",
        $isNodeAnimated: true,
        $nodeAnimationVariant: "pulse",
      },
      child: { $parent: "root.group", $label: "Tool" },
      first: {
        value: "One",
        $isNodeAnimated: true,
        $nodeAnimationVariant: "pulse",
      },
      second: { value: "Two", $isNodeAnimated: true },
    }),
  );
  const parent = page.locator(
    '.flow-sdk-container[data-node-id="root.group"] .flow-sdk-node-border-animation',
  );
  await expect(parent).toHaveAttribute("data-animation-variant", "pulse");
  await expectMotion(parent, "opacity");
  await page.evaluate(() =>
    window.__flowTest.configure({ isMultiSelectMode: true }),
  );
  await page
    .locator(
      '.flow-sdk-node[data-node-id="root.first"] [data-flow-node-surface]',
    )
    .click();
  await page
    .locator(
      '.flow-sdk-node[data-node-id="root.second"] [data-flow-node-surface]',
    )
    .click();
  const selector = page.getByRole("combobox", {
    name: "Node animation",
    exact: true,
  });
  await expect(selector).toContainText("Mixed");
  await chooseToolbarOption(selector, "Pulse");
  await expect(
    page.locator(
      '.flow-sdk-node[data-node-id="root.first"] .flow-sdk-node-border-pulse',
    ),
  ).toHaveCount(1);
  await expect(
    page.locator(
      '.flow-sdk-node[data-node-id="root.second"] .flow-sdk-node-border-pulse',
    ),
  ).toHaveCount(1);
  await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
  await expect(selector).toHaveCount(0);
  await ready(page);
  await page.evaluate(() =>
    window.__flowTest.replaceGraph({
      nodes: [
        { data: { id: "first", type: "text", label: "First" } },
        { data: { id: "second", type: "text", label: "Second" } },
      ],
      edges: [
        {
          data: {
            id: "reverse",
            source: "first",
            target: "second",
            isInverted: true,
            isEdgeAnimated: true,
            edgeAnimationVariant: "traveling",
          },
        },
      ],
    }),
  );
  await expect(page.locator(".flow-sdk-edge-trace-reverse")).toHaveCount(1);
  await expect(page.locator(".flow-sdk-edge-trace-reverse")).toHaveCSS(
    "animation-direction",
    "reverse",
  );
});
