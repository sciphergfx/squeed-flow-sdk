import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`background theme picker updates defaults at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json");
    await page.evaluate(() =>
      window.__flowTest.replaceDocument({
        alpha: { $label: "Alpha" },
        beta: { $label: "Beta", $bgColor: "red.500" },
      }),
    );
    const original = await page.evaluate(() =>
      structuredClone(window.__flowTest.document),
    );
    const picker = page.getByRole("group", {
      name: "Graph theme",
      exact: true,
    });
    await expect(picker).toHaveCount(0);
    await page.mouse.click(10, 10);
    await expect(picker).toBeVisible();
    const order = await picker.evaluate((element) => {
      const mode = document.querySelector('[aria-label="Toggle array mode"]');
      return !!(
        mode!.compareDocumentPosition(element) &
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(order).toBe(true);
    const alpha = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    const beta = page.locator('.flow-sdk-node[data-node-id="root.beta"]');
    const fills = () =>
      page.evaluate(() =>
        ["root.alpha", "root.beta"].map((id) => {
          const surface = document.querySelector(
            `.flow-sdk-node[data-node-id="${id}"] [data-flow-node-surface]`,
          )!;
          return getComputedStyle(surface).backgroundColor;
        }),
      );
    const before = await fills();
    await picker
      .getByRole("button", { name: "Graph theme green.500", exact: true })
      .click();
    await expect(
      picker.getByRole("button", {
        name: "Graph theme green.500",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await fills())[0]).not.toBe(before[0]);
    expect((await fills())[1]).toBe(before[1]);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      original,
    );
    expect(
      await page.evaluate(() =>
        window.__flowTest.events.filter(
          (event) => event.name === "theme-color",
        ),
      ),
    ).toEqual([{ name: "theme-color", value: "green.500" }]);
    await picker.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("graph-theme.png") });
    await alpha.locator("p").click();
    await expect(picker).toHaveCount(0);
    await page.mouse.click(10, 10);
    await expect(picker).toBeVisible();
    await page.locator(".flow-sdk-edge").first().dispatchEvent("click");
    await expect(picker).toHaveCount(0);
    await page.mouse.click(10, 10);
    await expect(picker).toBeVisible();
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(picker).toHaveCount(0);
    await expect(beta).toHaveCount(1);
  });
}

test("controlled graph theme remains owned by the consumer", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.__flowTest.configure({ themeColor: "purple.500" }),
  );
  await page.mouse.click(10, 10);
  const purple = page.getByRole("button", {
    name: "Graph theme purple.500",
    exact: true,
  });
  await expect(purple).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Graph theme green.500", exact: true })
    .click();
  await expect(purple).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "theme-color"),
    ),
  ).toEqual([{ name: "theme-color", value: "green.500" }]);
  await page.evaluate(() =>
    window.__flowTest.configure({ themeColor: "green.500" }),
  );
  await expect(
    page.getByRole("button", { name: "Graph theme green.500", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
