import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("shared icons render names, uploaded SVGs and URLs in SVG context", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "?custom=svg-icons");
  const setIcon = async (icon: string) =>
    page.evaluate(
      (icon) =>
        window.__flowTest.replaceGraph({
          nodes: [{ data: { id: "alpha", type: "text", config: { icon } } }],
          edges: [],
        }),
      icon,
    );
  const node = page.locator("[data-svg-icon-node]");
  await setIcon("PiWarningCircleFill");
  await expect(node.locator("svg path")).toHaveCount(1);
  await expect(node.locator("svg")).toHaveAttribute("width", "100");
  await expect(node.locator("svg")).toHaveAttribute("x", "70");
  const markup =
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#16a34a"/></svg>';
  const dataUrl =
    "data:image/svg+xml;base64," + Buffer.from(markup).toString("base64");
  await setIcon(dataUrl);
  const image = node.locator("image");
  await expect(image).toHaveAttribute("href", dataUrl);
  expect(await image.evaluate((element) => element.namespaceURI)).toBe(
    "http://www.w3.org/2000/svg",
  );
  await expect(node.locator("img")).toHaveCount(0);
  await expect(image).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
  const url = "https://icons.example.test/validated.svg";
  await page.route(url, (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: markup }),
  );
  const response = page.waitForResponse(url);
  await setIcon(url);
  expect((await response).status()).toBe(200);
  await expect(image).toHaveAttribute("href", url);
  await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("svg-image-icon.png") });
  await setIcon("PiWarningCircleFill");
  await expect(node.locator("image")).toHaveCount(0);
  await expect(node.locator("svg path")).toHaveCount(1);
  expect(errors).toEqual([]);
});
