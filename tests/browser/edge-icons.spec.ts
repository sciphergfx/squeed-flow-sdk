import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#16a34a"/></svg>';
for (const width of [1440, 390]) {
  test(`selected edge icons persist and render at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=connections");
    await page.evaluate(() =>
      window.__flowTest.configure({ edgeMode: "properties" }),
    );
    const original = await page.evaluate(() =>
      structuredClone(window.__flowTest.document),
    );
    const edge = page.locator('.flow-sdk-edge[data-source-property="api"]');
    await edge.dispatchEvent("click");
    const trigger = page.getByRole("button", {
      name: "Choose edge icon",
      exact: true,
    });
    const field = page.getByRole("textbox", { name: "Edge icon", exact: true });
    const label = page.locator(
      '.flow-sdk-edge-label[data-source-property="api"]',
    );
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Choose edge icon",
      exact: true,
    });
    await dialog
      .getByRole("textbox", { name: "Search icons", exact: true })
      .fill("gear");
    await dialog
      .getByRole("button", { name: "Choose PiGear", exact: true })
      .click();
    await expect(field).toHaveValue("PiGear");
    await expect(label.locator(".flow-sdk-edge-icon svg")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Close selection tools", exact: true })
      .click();
    await label.locator(".flow-sdk-edge-icon").click();
    await expect(field).toHaveValue("PiGear");
    expect(
      await page.evaluate(() => window.__flowTest.document.alpha.$connections),
    ).toEqual([
      { ...original.alpha.$connections[0], icon: "PiGear" },
      original.alpha.$connections[1],
    ]);
    await trigger.click();
    await dialog.getByRole("tab", { name: "Custom SVG", exact: true }).click();
    await dialog.getByLabel("Upload SVG icon", { exact: true }).setInputFiles({
      name: "bad.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<html/>"),
    });
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(field).toHaveValue("PiGear");
    await dialog.getByLabel("Upload SVG icon", { exact: true }).setInputFiles({
      name: "edge.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(svg),
    });
    const encoded =
      "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
    await expect(field).toHaveValue(encoded);
    await expect(label.locator("image")).toHaveAttribute("href", encoded);
    await page.evaluate(() =>
      window.__flowTest.replaceDocument(
        JSON.parse(JSON.stringify(window.__flowTest.document)),
      ),
    );
    await expect(label.locator("image")).toHaveAttribute("href", encoded);
    const url = "https://icons.example.test/edge.svg";
    await page.route(url, (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: svg }),
    );
    await trigger.click();
    await dialog
      .getByRole("textbox", { name: "SVG URL", exact: true })
      .fill(url);
    await dialog
      .getByRole("button", { name: "Apply URL", exact: true })
      .click();
    await expect(label.locator("image")).toHaveAttribute("href", url);
    const text = page.getByRole("textbox", { name: "Edge label", exact: true });
    await text.fill("With icon");
    await text.press("Enter");
    await expect(label.locator("text")).toHaveText("With icon");
    expect(
      await label.evaluate((element) => {
        const image = element.querySelector("image")!.getBBox();
        const text = element.querySelector("text")!.getBBox();
        return image.x + image.width <= text.x + 1;
      }),
    ).toBe(true);
    await trigger.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("edge-icon.png") });
    await trigger.click();
    await dialog
      .getByRole("button", { name: "Remove edge icon", exact: true })
      .click();
    await expect(label.locator(".flow-sdk-edge-icon")).toHaveCount(0);
    await expect(field).toHaveValue("");
    expect(
      await page.evaluate(
        () => window.__flowTest.document.alpha.$connections[0].icon,
      ),
    ).toBeUndefined();
    await page.evaluate(() =>
      window.__flowTest.configure({ selectionToolbar: { hide: ["icon"] } }),
    );
    await expect(trigger).toHaveCount(0);
    await expect(field).toHaveCount(0);
    await page.evaluate(() =>
      window.__flowTest.configure({ readOnly: true, selectionToolbar: {} }),
    );
    await expect(trigger).toHaveCount(0);
  });
}

test("raw edge icon callback updates only the selected edge", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator('.flow-sdk-edge-label[data-edge-id="alpha-beta"] text')
    .click();
  const field = page.getByRole("textbox", { name: "Edge icon", exact: true });
  await field.fill("PiGear");
  await field.press("Enter");
  await expect(
    page.locator(
      '.flow-sdk-edge-label[data-edge-id="alpha-beta"] .flow-sdk-edge-icon svg',
    ),
  ).toHaveCount(1);
  await expect(
    page.locator(
      '.flow-sdk-edge-label[data-edge-id="beta-gamma"] .flow-sdk-edge-icon',
    ),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "edge-icon"),
    ),
  ).toEqual([
    { name: "edge-icon", value: { id: "alpha-beta", icon: "PiGear" } },
  ]);
});
