import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`SVG download includes nodes and edges at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page);
    await page
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    const before = await page.evaluate(() => ({
      zoom: window.__flowTest.engine!.zoom(),
      pan: window.__flowTest.engine!.pan(),
    }));
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download SVG", exact: true })
      .click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("squeed.svg");
    const path = testInfo.outputPath("squeed.svg");
    await download.saveAs(path);
    const svg = await readFile(path, "utf8");
    const result = await page.evaluate((source) => {
      const xml = new DOMParser().parseFromString(source, "image/svg+xml");
      return {
        errors: xml.querySelectorAll("parsererror").length,
        root: xml.documentElement.localName,
        nodes: xml.querySelectorAll(".flow-sdk-node").length,
        edges: xml.querySelectorAll(".flow-sdk-edge").length,
        controls: xml.querySelectorAll(
          "button, [role=toolbar], .flow-sdk-property-port",
        ).length,
        foreignObject: xml.querySelectorAll("foreignObject").length,
        hitPaths: xml.querySelectorAll(".flow-sdk-edge-hit").length,
        unfilledStrokes: [
          ...xml.querySelectorAll(".flow-sdk-edge > path[stroke]"),
        ].every((element) => element.getAttribute("fill") === "none"),
      };
    }, svg);
    expect(result.errors).toBe(0);
    expect(result.root).toBe("svg");
    expect(result.nodes).toBeGreaterThan(1);
    expect(result.edges).toBeGreaterThan(0);
    expect(result.controls).toBe(0);
    expect(result.hitPaths).toBe(0);
    expect(result.unfilledStrokes).toBe(true);
    expect(result.foreignObject).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => ({
        zoom: window.__flowTest.engine!.zoom(),
        pan: window.__flowTest.engine!.pan(),
      })),
    ).toEqual(before);
    await expect(
      page.getByRole("button", { name: "Download SVG", exact: true }),
    ).toBeEnabled();
    const preview = await page.context().newPage();
    await preview.route("**/exported.svg", (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: svg }),
    );
    await preview.goto("http://127.0.0.1:4196/exported.svg");
    await expect(preview.locator(".flow-sdk-node").first()).toBeVisible();
    await expect(preview.locator(".flow-sdk-edge").first()).toBeVisible();
    await preview.screenshot({
      path: testInfo.outputPath("export-preview.png"),
    });
    await preview.close();
  });
}
