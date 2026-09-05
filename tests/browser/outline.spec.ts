import { expect, test, type Page } from "@playwright/test";
import { expectScrollableToolbar, ready } from "./helpers";

async function nodePaint(page: Page, id: string) {
  return page
    .locator(`.flow-sdk-node[data-node-id="${id}"]`)
    .evaluate((element: HTMLElement) => {
      const surfaces = [...element.querySelectorAll<HTMLElement>("div")].map(
        (child) => getComputedStyle(child),
      );
      return {
        width: element.offsetWidth,
        height: element.offsetHeight,
        fills: surfaces
          .map((style) => style.backgroundColor)
          .filter((color) => color !== "rgba(0, 0, 0, 0)"),
        borders: surfaces
          .filter((style) => parseFloat(style.borderTopWidth) > 0)
          .map((style) => style.borderTopColor),
      };
    });
}

for (const type of ["text", "arrayView", "objectView"] as const) {
  for (const colorMode of ["light", "dark"] as const) {
    test(`${type} outline removes fill and restores it in ${colorMode} mode`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await ready(page);
      await page.evaluate(
        ({ type, colorMode }) => {
          window.__flowTest.configure({ colorMode });
          window.__flowTest.replaceGraph({
            nodes: [
              {
                data: {
                  id: "alpha",
                  type,
                  label: "Style test",
                  headerTitle: "Style test",
                  description: { status: "ready" },
                  viewProps: { bgColor: "#29865b" },
                },
              },
            ],
            edges: [],
          });
        },
        { type, colorMode },
      );
      const node = page.locator('.flow-sdk-node[data-node-id="alpha"]');
      await expect(node.locator("p").first()).toHaveText("Style test");
      const initial = await nodePaint(page, "alpha");
      expect(initial.fills.length).toBeGreaterThan(0);
      await node.click();
      const toggle = page.getByRole("button", {
        name: "Toggle node outline",
        exact: true,
      });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await page.mouse.click(10, 10);
      const outlined = await nodePaint(page, "alpha");
      expect(outlined.fills).toEqual([]);
      await expect
        .poll(async () => (await nodePaint(page, "alpha")).borders)
        .toContain("rgb(41, 134, 91)");
      expect(outlined.width).toBe(initial.width);
      expect(outlined.height).toBe(initial.height);
      await node.click();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await page.mouse.click(10, 10);
      expect((await nodePaint(page, "alpha")).fills).toEqual(initial.fills);
      expect(errors).toEqual([]);
    });
  }
}

test("JSON outline supports mixed selections without changing mappings or saved colors", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  const original = await page.evaluate(() => window.__flowTest.document);
  const alpha = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
  await alpha.click();
  const toggle = page.getByRole("button", {
    name: "Toggle node outline",
    exact: true,
  });
  await toggle.click();
  await page.evaluate(() =>
    window.__flowTest.configure({ isMultiSelectMode: true }),
  );
  await page.locator('.flow-sdk-node[data-node-id="root.beta"]').click();
  await expect(toggle).toHaveAttribute("aria-pressed", "mixed");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.__flowTest.document)).toEqual({
    ...original,
    alpha: { ...original.alpha, $outline: true },
    beta: { ...original.beta, $outline: true },
  });
  await toggle.click();
  expect(
    await page.evaluate(() => [
      window.__flowTest.document.alpha.$outline,
      window.__flowTest.document.beta.$outline,
    ]),
  ).toEqual([false, false]);
});

test("container outline defaults can be overridden and edge-label masks use the unfilled background", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    window.__flowTest.configure({
      backgroundColor: "#ffffff",
      parentNodeStyle: { outline: true, bgColor: "teal.500" },
    });
    window.__flowTest.replaceGraph({
      nodes: [
        { data: { id: "group", type: "objectView", label: "Group" } },
        {
          data: { id: "alpha", type: "text", label: "First", parent: "group" },
        },
        {
          data: { id: "beta", type: "text", label: "Second", parent: "group" },
        },
      ],
      edges: [
        {
          data: {
            id: "inside",
            source: "alpha",
            target: "beta",
            label: "Internal",
          },
        },
      ],
    });
  });
  const group = page.locator('.flow-sdk-container[data-node-id="group"]');
  await expect(group.locator("rect").first()).toHaveAttribute(
    "fill",
    "transparent",
  );
  await expect(
    page.locator(
      '.flow-sdk-edge[data-edge-id="inside"] .flow-sdk-edge-label rect',
    ),
  ).toHaveAttribute("fill", /^#ffffff$/i);
  await group.locator("text").click();
  const toggle = page.getByRole("button", {
    name: "Toggle node outline",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(group.locator("rect").first()).not.toHaveAttribute(
    "fill",
    "transparent",
  );
  await expect(group.locator("rect").first()).toHaveAttribute(
    "fill-opacity",
    "0.4",
  );
});

test("outline and transparent styling keep a JSON array leaf editable and mapped", async ({
  page,
}) => {
  await ready(page, "?graph=json");
  await page.evaluate(() =>
    window.__flowTest.replaceDocument({
      tags: ["beta", "stable"],
      source: { $connections: [{ target: "root.tags.1" }] },
    }),
  );
  const node = page.locator('.flow-sdk-node[data-node-id="root.tags.1"]');
  await node.click();
  await page
    .getByRole("button", { name: "Background transparent", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle node outline", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Toggle node outline", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const label = page.getByRole("textbox", { name: "Node label", exact: true });
  await label.fill("Styled tag");
  await label.press("Enter");
  await expect(node.locator("p[title]")).toHaveText("Styled tag");
  expect(
    await page.evaluate(() => window.__flowTest.document.tags[1]),
  ).toMatchObject({
    $label: "Styled tag",
    $bgColor: "transparent",
    $outline: true,
  });
  await expect(
    page.locator('.flow-sdk-node[data-node-id="root.tags.1.0"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('.flow-sdk-edge[data-edge-id^="connection:"]'),
  ).toHaveCount(1);
});

test("read-only and hidden controls cannot toggle outlines", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.locator('.flow-sdk-node[data-node-id="root.alpha"]').click();
  await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
  await expect(
    page.getByRole("button", { name: "Toggle node outline", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    window.__flowTest.configure({
      readOnly: false,
      selectionToolbar: { hide: ["outline"] },
    }),
  );
  await expect(
    page.getByRole("button", { name: "Toggle node outline", exact: true }),
  ).toHaveCount(0);
});

test.describe("mobile styling controls", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("outline and transparent swatches are reachable without clipped controls", async ({
    page,
  }, testInfo) => {
    await ready(page, "?graph=connections");
    await page.locator('.flow-sdk-node[data-node-id="root.alpha"]').tap();
    await page
      .getByRole("button", { name: "Background transparent", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Toggle node outline", exact: true })
      .tap();
    await expect(
      page.getByRole("button", { name: "Toggle node outline", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expectScrollableToolbar(page);
    await page.screenshot({ path: testInfo.outputPath("outline-mobile.png") });
  });
});
