import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("nodes is the default attachment mode and workflow remains a compatible alias", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  const paths = () =>
    page
      .locator(".flow-sdk-edge > path:first-child")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("d")),
      );
  const original = await page.evaluate(() => window.__flowTest.document);
  const defaultPaths = await paths();
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "properties" }),
  );
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(8);
  await expect.poll(paths).not.toEqual(defaultPaths);
  await page.evaluate(() => window.__flowTest.configure({ edgeMode: "nodes" }));
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(0);
  await expect.poll(paths).toEqual(defaultPaths);
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "workflow" }),
  );
  await expect.poll(paths).toEqual(defaultPaths);
  expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
    original,
  );
});
