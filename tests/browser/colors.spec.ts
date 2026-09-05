import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const type of ["text", "arrayView", "objectView"] as const) {
  test(`${type} supports transparent fill, text, icon and border`, async ({ page }) => {
    await ready(page);
    await page.evaluate((type) => window.__flowTest.replaceGraph({
      nodes: [{ data: {
        id: "alpha", type, label: "Transparent node", headerTitle: "Transparent node", description: { status: "ready" },
        config: { icon: "PiGear" },
        viewProps: { bgColor: "transparent", textColor: "transparent", borderColor: "transparent" },
      } }], edges: [],
    }), type);
    const node = page.locator('.flow-sdk-node[data-node-id="alpha"]');
    await expect(node.locator("p").first()).toHaveCSS("color", "rgba(0, 0, 0, 0)");
    const painted = await node.evaluate((element) => [...element.querySelectorAll<HTMLElement>("div, p")].filter((child) => {
      const style = getComputedStyle(child);
      return style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        (parseFloat(style.borderTopWidth) > 0 && style.borderTopColor !== "rgba(0, 0, 0, 0)");
    }).map((element) => element.outerHTML.slice(0, 100)));
    expect(painted).toEqual([]);
    await expect(node.locator('svg[width="80"], svg[width="100"], svg[width="64"]').first()).toHaveCSS("color", "rgba(0, 0, 0, 0)");
  });
}

test("every palette exposes transparent once and JSON resets restore the node", async ({ page }) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() => window.__flowTest.configure({ selectionToolbar: { palette: ["red.500", "transparent"] } }));
  const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
  await node.click();
  const label = node.locator("p").first();
  const originalTextColor = await label.evaluate((element) => getComputedStyle(element).color);
  const original = await page.evaluate(() => window.__flowTest.document.alpha);
  const background = page.getByRole("button", { name: "Background transparent", exact: true });
  const text = page.getByRole("button", { name: "Text color transparent", exact: true });
  await expect(background).toHaveCount(1);
  await expect(text).toHaveCount(1);
  await background.click();
  await expect(background).toHaveAttribute("aria-pressed", "true");
  await text.click();
  await expect(label).toHaveCSS("color", "rgba(0, 0, 0, 0)");
  expect(await page.evaluate(() => window.__flowTest.document.alpha)).toEqual({ ...original, $bgColor: "transparent", $textColor: "transparent" });
  await page.getByRole("button", { name: "Reset Background", exact: true }).click();
  await page.getByRole("button", { name: "Reset Text color", exact: true }).click();
  await expect(label).toHaveCSS("color", originalTextColor);
  expect(await page.evaluate(() => window.__flowTest.document.alpha)).toEqual(original);
});

test("transparent mapped edges hide their line, arrow and label mask and can be reset", async ({ page }) => {
  await ready(page, "?graph=connections");
  const edge = page.locator('.flow-sdk-edge[data-source-property="runtime"]');
  await edge.click();
  const label = page.getByRole("textbox", { name: "Edge label", exact: true });
  await label.fill("Maps");
  await label.press("Enter");
  const path = edge.locator(":scope > path").first();
  const originalColor = await path.getAttribute("stroke");
  await page.getByRole("button", { name: "Edge color transparent", exact: true }).click();
  await expect(path).toHaveAttribute("stroke", "transparent");
  await expect(edge.locator(":scope > path").nth(1)).toHaveAttribute("fill", "transparent");
  await expect(edge.locator(".flow-sdk-edge-label rect")).toHaveAttribute("fill", "transparent");
  await expect(edge.locator(".flow-sdk-edge-label text")).toHaveAttribute("fill", "transparent");
  expect(await page.evaluate(() => window.__flowTest.document.alpha.$connections[1].color)).toBe("transparent");
  await page.getByRole("button", { name: "Reset Edge color", exact: true }).click();
  await expect(path).toHaveAttribute("stroke", originalColor!);
});

test("transparent compound-node colors and canvas backgrounds reach SVG and DOM", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.__flowTest.configure({ backgroundColor: "transparent", backgroundPattern: "none" });
    window.__flowTest.replaceGraph({ nodes: [
      { data: { id: "group", type: "objectView", label: "Container", viewProps: { bgColor: "transparent", borderColor: "transparent", textColor: "transparent" } } },
      { data: { id: "alpha", type: "text", label: "Child", parent: "group" } },
    ], edges: [] });
  });
  const container = page.locator('.flow-sdk-container[data-node-id="group"]');
  await expect(container.locator("rect").first()).toHaveAttribute("fill", "transparent");
  await expect(container.locator("rect").first()).toHaveAttribute("stroke", "transparent");
  await expect(container.locator("text")).toHaveAttribute("fill", "transparent");
});

for (const colorMode of ["light", "dark"] as const) {
  test(`transparent fills retain readable default text in ${colorMode} mode`, async ({ page }) => {
    await ready(page);
    await page.evaluate((colorMode) => {
      window.__flowTest.configure({ colorMode });
      window.__flowTest.replaceGraph({ nodes: ["text", "arrayView", "objectView"].map((type) => ({ data: {
        id: type, type, label: "Visible text", headerTitle: "Visible text", description: { status: "ready" }, viewProps: { bgColor: "transparent" },
      } })), edges: [] });
    }, colorMode);
    await expect(page.locator(".flow-sdk-node p").first()).toHaveText("Visible text");
    const colors = await page.locator(".flow-sdk-node p").evaluateAll((labels) => labels.map((label) => getComputedStyle(label).color));
    expect(new Set(colors).size).toBe(1);
    expect(colors[0]).not.toBe("rgba(0, 0, 0, 0)");
  });
}