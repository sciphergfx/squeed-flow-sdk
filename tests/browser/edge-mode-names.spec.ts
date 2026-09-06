import { expect, test } from "@playwright/test";
import { chooseToolbarOption, ready } from "./helpers";

test("auto shows both edge kinds and explicit modes filter without editing the document", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page
    .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
    .click();
  const mode = page.getByRole("combobox", { name: "Edge mode", exact: true });
  const edges = page.locator(".flow-sdk-edge");
  const properties = page.locator(
    ".flow-sdk-edge[data-source-property], .flow-sdk-edge[data-target-property]",
  );
  const normal = page.locator(
    ".flow-sdk-edge:not([data-source-property]):not([data-target-property])",
  );
  const original = await page.evaluate(() => window.__flowTest.document);
  await expect(mode).toHaveAttribute("title", "Connections: Auto");
  await expect(edges).toHaveCount(6);
  await expect(properties).toHaveCount(2);
  await expect(normal).toHaveCount(4);
  const originalIds = await edges.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-edge-id")).sort(),
  );
  await chooseToolbarOption(mode, "Properties");
  await expect(edges).toHaveCount(2);
  await expect(normal).toHaveCount(0);
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(4);
  await chooseToolbarOption(mode, "Nodes");
  await expect(edges).toHaveCount(4);
  await expect(properties).toHaveCount(0);
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(0);
  await expect(
    page.locator(
      ".flow-sdk-edge-label[data-source-property], .flow-sdk-edge-label[data-target-property]",
    ),
  ).toHaveCount(0);
  await chooseToolbarOption(mode, "Auto");
  await expect(edges).toHaveCount(6);
  expect(
    await edges.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-edge-id")).sort(),
    ),
  ).toEqual(originalIds);
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "workflow" }),
  );
  await expect(mode).toHaveAttribute("title", "Connections: Nodes");
  await expect(edges).toHaveCount(4);
  await expect(properties).toHaveCount(0);
  expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
    original,
  );
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "json-change"),
    ),
  ).toEqual([]);
});
