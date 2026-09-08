import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("touch users can always reach the bottom toolbar after unpinning", async ({
  page,
}) => {
  await ready(page, "custom=1");
  const toolbar = page.getByRole("toolbar", {
    name: "Diagram controls",
    exact: true,
  });
  const scroll = toolbar.locator("[data-flow-toolbar-scroll]");
  await expect(scroll).toBeInViewport();
  await toolbar.getByRole("button", { name: "Pin", exact: true }).tap();
  await page
    .locator("html")
    .dispatchEvent("pointerleave", { pointerType: "touch" });
  await expect(toolbar).toHaveCSS("visibility", "visible");
  await expect(toolbar).toHaveCSS("opacity", "1");
  await expect(scroll).toBeInViewport();
  const expand = toolbar.getByRole("button", {
    name: "Toggle toolbar collapse",
    exact: true,
  });
  await expand.scrollIntoViewIfNeeded();
  await expand.tap();
  const collapse = toolbar.getByRole("button", {
    name: "Collapse all",
    exact: true,
  });
  await collapse.scrollIntoViewIfNeeded();
  await expect(collapse).toBeInViewport();
  await collapse.tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(scroll).toBeInViewport();
  const box = await scroll.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(370);
  await page.screenshot({ path: test.info().outputPath("mobile-toolbar.png") });
});
