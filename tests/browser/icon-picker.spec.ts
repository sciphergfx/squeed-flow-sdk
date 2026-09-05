import { expect, test } from "@playwright/test";
import { ready, chooseToolbarOption } from "./helpers";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>&#9733; icon</title><circle cx="12" cy="12" r="10" fill="#16a34a"/></svg>';

for (const width of [1440, 390]) {
  test(`icon picker saves names, uploads and URLs at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json");
    if (width === 390)
      await page.evaluate(() =>
        window.__flowTest.configure({ colorMode: "dark" }),
      );
    const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    await node.locator("p").first().click();
    const original = await page.evaluate(() =>
      structuredClone(window.__flowTest.document),
    );
    const trigger = page.getByRole("button", {
      name: "Choose node icon",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Choose node icon",
      exact: true,
    });
    await page
      .getByRole("textbox", { name: "Search icons", exact: true })
      .fill("gear");
    await expect(
      page.getByRole("button", { name: "Choose PiGear", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("icon-grid.png") });
    await page
      .getByRole("button", { name: "Choose PiGear", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(
      await page.evaluate(() => window.__flowTest.document.alpha.$icon),
    ).toBe("PiGear");
    await expect(node.locator('svg[width="80"]')).toHaveCount(1);
    await trigger.click();
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Icon source", exact: true }),
      "Custom SVG",
    );
    const upload = page.getByLabel("Upload SVG icon", { exact: true });
    await upload.setInputFiles({
      name: "bad.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<html>invalid</html>"),
    });
    await expect(dialog.getByRole("alert")).toHaveText(
      "Choose a valid SVG file.",
    );
    await upload.setInputFiles({
      name: "script.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
      ),
    });
    await expect(dialog.getByRole("alert")).toHaveText(
      "SVG scripts and event handlers are not allowed.",
    );
    expect(
      await page.evaluate(() => window.__flowTest.document.alpha.$icon),
    ).toBe("PiGear");
    const unicodeSvg = svg.replace("&#9733;", String.fromCodePoint(9733));
    await upload.setInputFiles({
      name: "icon.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(unicodeSvg),
    });
    await expect(dialog).not.toBeVisible();
    const stored = await page.evaluate(
      () => window.__flowTest.document.alpha.$icon,
    );
    expect(stored).toBe(
      `data:image/svg+xml;base64,${Buffer.from(unicodeSvg).toString("base64")}`,
    );
    await expect
      .poll(() =>
        node
          .locator("img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0,
          ),
      )
      .toBe(true);
    const saved = await page.evaluate(() =>
      JSON.parse(JSON.stringify(window.__flowTest.document)),
    );
    await page.evaluate(
      (saved) => window.__flowTest.replaceDocument(saved),
      saved,
    );
    await expect(node.locator("img")).toHaveAttribute("src", stored);
    await page.screenshot({ path: testInfo.outputPath("uploaded-icon.png") });
    await trigger.click();
    await expect(
      page.getByRole("combobox", { name: "Icon source", exact: true }),
    ).toHaveText("Custom SVG");
    const url = page.getByRole("textbox", { name: "SVG URL", exact: true });
    await url.fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Apply URL", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Enter an HTTP or HTTPS image URL.",
    );
    await page.route("https://icons.example.test/icon.svg", (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: svg }),
    );
    await url.fill("https://icons.example.test/icon.svg");
    await page.getByRole("button", { name: "Apply URL", exact: true }).click();
    await expect(node.locator("img")).toHaveAttribute(
      "src",
      "https://icons.example.test/icon.svg",
    );
    await expect
      .poll(() =>
        node
          .locator("img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0,
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => window.__flowTest.document.alpha.$icon),
    ).toBe("https://icons.example.test/icon.svg");
    await trigger.click();
    await page
      .getByRole("button", { name: "Remove node icon", exact: true })
      .click();
    await expect(node.locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      original,
    );
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(trigger).toHaveCount(0);
  });
}
