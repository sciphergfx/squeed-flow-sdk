import { expect, test } from "@playwright/test";
import { clearEvents, ready } from "./helpers";

test("one palette edits borders without removing fill and hides only text colors", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  const original = await page.evaluate(() => window.__flowTest.document.alpha);
  await page
    .locator('.flow-sdk-node[data-node-id="root.alpha"] p[title]')
    .click();
  const surface = page.locator(
    '.flow-sdk-node[data-node-id="root.alpha"] [data-flow-node-surface]',
  );
  const outline = page.getByRole("button", {
    name: "Toggle node outline",
    exact: true,
  });
  const mode = page.getByRole("button", {
    name: "Edit node border",
    exact: true,
  });
  const colors = page.getByRole("group", { name: "Border color", exact: true });
  const background = page.getByRole("group", {
    name: "Background",
    exact: true,
  });
  const textColors = page.getByRole("group", {
    name: "Text color",
    exact: true,
  });
  await expect(colors).toHaveCount(0);
  await expect(background).toBeVisible();
  await expect(textColors).toBeVisible();
  const swatchCount = await background.getByRole("button").count();
  await background
    .getByRole("button", { name: "Background blue.500", exact: true })
    .click();
  const fill = await surface.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(fill).not.toBe("rgba(0, 0, 0, 0)");
  await mode.click();
  await expect(mode).toHaveAttribute("aria-pressed", "true");
  await expect(outline).toHaveAttribute("aria-pressed", "false");
  await expect(textColors).toHaveCount(0);
  expect(await page.evaluate(() => window.__flowTest.document.alpha)).toEqual({
    ...original,
    $bgColor: "blue.500",
  });
  await expect(colors).toBeVisible();
  await expect(background).toHaveCount(0);
  await expect(colors.getByRole("button")).toHaveCount(swatchCount);
  const red = colors.getByRole("button", {
    name: "Border color red.500",
    exact: true,
  });
  await red.click();
  await expect(red).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.__flowTest.document.alpha)).toEqual({
    ...original,
    $bgColor: "blue.500",
    $borderColor: "red.500",
  });
  await expect(surface).toHaveCSS("background-color", fill);
  await mode.click();
  await expect(colors).toHaveCount(0);
  await expect(textColors).toBeVisible();
  await expect(
    background.getByRole("button", {
      name: "Background blue.500",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await background
    .getByRole("button", { name: "Background green.500", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__flowTest.document.alpha.$borderColor),
  ).toBe("red.500");
  await mode.click();
  await expect(background).toHaveCount(0);
  await expect(red).toHaveAttribute("aria-pressed", "true");
  await colors
    .getByRole("button", { name: "Border color transparent", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__flowTest.document.alpha.$borderColor),
  ).toBe("transparent");
  await colors
    .getByRole("button", { name: "Reset Border color", exact: true })
    .click();
  expect(await page.evaluate(() => window.__flowTest.document.alpha)).toEqual({
    ...original,
    $bgColor: "green.500",
  });
});

for (const type of ["text", "arrayView", "objectView"] as const) {
  test(`${type} border picker colors the outline and animated stroke in raw graphs`, async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate((type) => {
      window.__flowTest.configure({
        selectionToolbar: { palette: ["#14b8a6"] },
      });
      window.__flowTest.replaceGraph({
        nodes: [
          {
            data: {
              id: "alpha",
              type,
              label: "Outlined",
              headerTitle: "Outlined",
              description: { status: "ready" },
              isNodeAnimated: true,
              viewProps: {
                outline: true,
                bgColor: "#29865b",
                textColor: "#123456",
              },
            },
          },
        ],
        edges: [],
      });
    }, type);
    const node = page.locator('.flow-sdk-node[data-node-id="alpha"]');
    const surface = node.locator("[data-flow-node-surface]");
    const animation = node.locator(".flow-sdk-node-border-animation");
    await expect(node.locator("p[title]")).toHaveText("Outlined");
    const originalAnimationColor = await animation.getAttribute("stroke");
    await node.locator("p[title]").click();
    await clearEvents(page);
    await page
      .getByRole("button", { name: "Edit node border", exact: true })
      .click();
    const colors = page.getByRole("group", {
      name: "Border color",
      exact: true,
    });
    await colors
      .getByRole("button", { name: "Border color #14b8a6", exact: true })
      .click();
    await expect(animation).toHaveAttribute("stroke", "#14b8a6");
    await expect(surface).toHaveCSS("border-top-color", "rgb(20, 184, 166)");
    await page.mouse.click(10, 10);
    await expect(surface).toHaveCSS("border-top-color", "rgb(20, 184, 166)");
    await expect(surface).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(node.locator("p[title]")).toHaveCSS(
      "color",
      "rgb(18, 52, 86)",
    );
    expect(
      await page.evaluate(() =>
        window.__flowTest.events.filter((event) =>
          ["border-color", "json"].includes(event.name),
        ),
      ),
    ).toEqual([
      { name: "border-color", value: { id: "alpha", color: "#14b8a6" } },
    ]);
    await node.locator("p[title]").click();
    await page
      .getByRole("button", { name: "Edit node border", exact: true })
      .click();
    await colors
      .getByRole("button", { name: "Reset Border color", exact: true })
      .click();
    await expect(animation).toHaveAttribute("stroke", originalAnimationColor!);
    await page.mouse.click(10, 10);
    await expect(surface).toHaveCSS("border-top-color", "rgb(41, 134, 91)");
  });
}

test("border mode applies to mixed selections without changing their fill modes", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  const original = await page.evaluate(() => window.__flowTest.document);
  await page
    .locator('.flow-sdk-node[data-node-id="root.alpha"] p[title]')
    .click();
  const outline = page.getByRole("button", {
    name: "Toggle node outline",
    exact: true,
  });
  const colors = page.getByRole("group", { name: "Border color", exact: true });
  await outline.click();
  await page.evaluate(() =>
    window.__flowTest.configure({ isMultiSelectMode: true }),
  );
  await page
    .locator('.flow-sdk-node[data-node-id="root.beta"] p[title]')
    .click();
  await expect(outline).toHaveAttribute("aria-pressed", "mixed");
  await expect(colors).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Background", exact: true }),
  ).toBeVisible();
  const mode = page.getByRole("button", {
    name: "Edit node border",
    exact: true,
  });
  await mode.click();
  await expect(
    page.getByRole("group", { name: "Background", exact: true }),
  ).toHaveCount(0);
  await colors
    .getByRole("button", { name: "Border color green.500", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle dashed border", exact: true })
    .click();
  const thickness = page.getByRole("spinbutton", {
    name: "Border thickness",
    exact: true,
  });
  await thickness.fill("9");
  await thickness.press("Enter");
  expect(await page.evaluate(() => window.__flowTest.document)).toEqual({
    ...original,
    alpha: {
      ...original.alpha,
      $outline: true,
      $borderColor: "green.500",
      $borderStyle: "dashed",
      $borderWidth: 9,
    },
    beta: {
      ...original.beta,
      $borderColor: "green.500",
      $borderStyle: "dashed",
      $borderWidth: 9,
    },
  });
  await expect(outline).toHaveAttribute("aria-pressed", "mixed");
  await mode.click();
  await expect(colors).toHaveCount(0);
});

test("border controls respect inherited outline, read-only, and hidden options", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    window.__flowTest.configure({
      parentNodeStyle: { outline: true, borderColor: "#14b8a6" },
      selectionToolbar: { palette: ["#14b8a6"] },
    });
    window.__flowTest.replaceGraph({
      nodes: [
        {
          data: {
            id: "group",
            type: "objectView",
            label: "Group",
            isNodeAnimated: true,
          },
        },
        {
          data: { id: "alpha", type: "text", label: "Child", parent: "group" },
        },
      ],
      edges: [],
    });
  });
  const group = page.locator('.flow-sdk-container[data-node-id="group"]');
  await group.locator("text").click();
  await page
    .getByRole("button", { name: "Edit node border", exact: true })
    .click();
  const colors = page.getByRole("group", { name: "Border color", exact: true });
  await expect(
    colors.getByRole("button", { name: "Border color #14b8a6", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await colors
    .getByRole("button", { name: "Border color transparent", exact: true })
    .click();
  await expect(group.locator("rect").first()).toHaveAttribute(
    "stroke",
    "transparent",
  );
  await expect(
    group.locator(".flow-sdk-node-border-animation"),
  ).toHaveAttribute("stroke", "transparent");
  await colors
    .getByRole("button", { name: "Reset Border color", exact: true })
    .click();
  await expect(group.locator("rect").first()).toHaveAttribute(
    "stroke",
    "#14b8a6",
  );
  await page
    .getByRole("button", { name: "Toggle dashed border", exact: true })
    .click();
  const thickness = page.getByRole("spinbutton", {
    name: "Border thickness",
    exact: true,
  });
  await thickness.fill("10");
  await thickness.press("Enter");
  await expect(group.locator("rect").first()).toHaveAttribute(
    "stroke-width",
    "10",
  );
  await expect(group.locator("rect").first()).toHaveAttribute(
    "stroke-dasharray",
    "40 20",
  );
  await thickness.fill("0");
  await thickness.press("Enter");
  await expect(group.locator(".flow-sdk-node-border-animation")).toHaveCount(0);
  await thickness.fill("");
  await thickness.press("Enter");
  await expect(group.locator("rect").first()).toHaveAttribute(
    "stroke-width",
    "6",
  );
  await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
  await expect(colors).toHaveCount(0);
  await page.evaluate(() =>
    window.__flowTest.configure({
      readOnly: false,
      selectionToolbar: { hide: ["borderColor"] },
    }),
  );
  await expect(colors).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Toggle node outline", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
  await page.evaluate(() =>
    window.__flowTest.configure({
      readOnly: false,
      selectionToolbar: { hide: ["outline"] },
    }),
  );
  await expect(colors).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Background", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit node border", exact: true })
    .click();
  await expect(colors).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Toggle node outline", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
  await page.evaluate(() =>
    window.__flowTest.configure({
      readOnly: false,
      selectionToolbar: { hide: ["color"] },
    }),
  );
  await expect(colors).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Background", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Toggle node outline", exact: true }),
  ).toBeVisible();
});

test.describe("mobile border colors", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("revealed swatches fit the toolbar and remain reachable", async ({
    page,
  }, testInfo) => {
    await ready(page, "?graph=connections");
    await page
      .locator('.flow-sdk-node[data-node-id="root.alpha"] p[title]')
      .tap();
    const colors = page.getByRole("group", {
      name: "Border color",
      exact: true,
    });
    await expect(colors).toHaveCount(0);
    await page
      .getByRole("button", { name: "Edit node border", exact: true })
      .tap();
    await expect(
      page.getByRole("group", { name: "Background", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Text color", exact: true }),
    ).toHaveCount(0);
    await colors
      .getByRole("button", { name: "Border color teal.500", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Toggle dashed border", exact: true })
      .tap();
    const thickness = page.getByRole("spinbutton", {
      name: "Border thickness",
      exact: true,
    });
    await thickness.fill("8");
    await thickness.press("Enter");
    const clipped = await page
      .getByRole("toolbar", { name: "Diagram controls" })
      .getByRole("button")
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => {
            const rect = button.getBoundingClientRect();
            return (
              rect.left < 0 ||
              rect.right > innerWidth ||
              rect.top < 0 ||
              rect.bottom > innerHeight
            );
          })
          .map((button) => button.getAttribute("aria-label")),
      );
    expect(clipped).toEqual([]);
    expect(
      await page.evaluate(() => window.__flowTest.document.alpha.$borderColor),
    ).toBe("teal.500");
    expect(
      await page.evaluate(() => window.__flowTest.document.alpha.$borderWidth),
    ).toBe(8);
    expect(
      await page.evaluate(() => window.__flowTest.document.alpha.$outline),
    ).toBeUndefined();
    await page.screenshot({
      path: testInfo.outputPath("border-colors-mobile.png"),
    });
    await page
      .getByRole("button", { name: "Edit node border", exact: true })
      .tap();
    await expect(colors).toHaveCount(0);
  });
});
