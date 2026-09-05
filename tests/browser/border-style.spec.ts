import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("border mode changes dash and thickness without changing the fill", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() =>
    window.__flowTest.configure({ selectionToolbar: { palette: ["#14b8a6"] } }),
  );
  const original = await page.evaluate(() => window.__flowTest.document);
  const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
  const surface = node.locator("[data-flow-node-surface]");
  const defaultWidth = await surface.evaluate(
    (element) => getComputedStyle(element).borderTopWidth,
  );
  await node.locator("p[title]").click();
  const fill = await surface.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(fill).not.toBe("rgba(0, 0, 0, 0)");
  const mode = page.getByRole("button", {
    name: "Edit node border",
    exact: true,
  });
  const dashed = page.getByRole("button", {
    name: "Toggle dashed border",
    exact: true,
  });
  const thickness = page.getByRole("spinbutton", {
    name: "Border thickness",
    exact: true,
  });
  await expect(dashed).toHaveCount(0);
  await expect(thickness).toHaveCount(0);
  await mode.click();
  expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
    original,
  );
  await expect(
    page.getByRole("group", { name: "Text color", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Border color #14b8a6", exact: true })
    .click();
  await dashed.click();
  await thickness.fill("12");
  await thickness.press("Enter");
  await expect(surface).toHaveCSS("border-top-color", "rgb(20, 184, 166)");
  await expect(surface).toHaveCSS("border-top-style", "dashed");
  await expect(surface).toHaveCSS("border-top-width", "12px");
  await expect(surface).toHaveCSS("background-color", fill);
  await expect(
    page.getByRole("button", { name: "Toggle node outline", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.__flowTest.document)).toEqual({
    ...original,
    alpha: {
      ...original.alpha,
      $borderColor: "#14b8a6",
      $borderStyle: "dashed",
      $borderWidth: 12,
    },
  });
  await thickness.fill("-3");
  await thickness.press("Enter");
  await expect(thickness).toHaveValue("12");
  expect(
    await page.evaluate(() => window.__flowTest.document.alpha.$borderWidth),
  ).toBe(12);
  await thickness.fill("0");
  await thickness.press("Enter");
  await expect(surface).toHaveCSS("border-top-width", "0px");
  expect(
    await page.evaluate(() => window.__flowTest.document.alpha.$borderWidth),
  ).toBe(0);
  await thickness.fill("");
  await thickness.press("Enter");
  await expect(surface).toHaveCSS("border-top-width", defaultWidth);
  expect(
    await page.evaluate(() => window.__flowTest.document.alpha.$borderWidth),
  ).toBeUndefined();
  await mode.click();
  await expect(dashed).toHaveCount(0);
  await expect(thickness).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Text color", exact: true }),
  ).toBeVisible();
  await mode.click();
  await expect(dashed).toHaveAttribute("aria-pressed", "true");
  await dashed.click();
  await expect(surface).toHaveCSS("border-top-style", "solid");
});
