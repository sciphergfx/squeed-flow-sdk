import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  for (const colorMode of ["light", "dark"] as const) {
    test(`Markdown formatting in ${colorMode} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 950 });
      await ready(page, "?graph=json");
      await page.evaluate(colorMode => {
        window.__flowTest.configure({ colorMode });
        window.__flowTest.replaceDocument({
          guide: {
            $label: "Maintenance",
            $content: "# Quick Start\n\nRead **important** notes and run `npm run build`.\n\n## Steps\n\n1. Install dependencies\n2. Run checks\n\n- Unit tests\n  - Geometry checks\n- Browser tests\n\n```sh\nnpm run typecheck\nnpm run build\nnpx playwright test tests/browser/a-long-test-file-name-that-should-scroll-instead-of-breaking-commands.spec.ts\n```\n\n> Preserve existing graph data.\n\nFinal paragraph.",
          },
        });
      }, colorMode);
      const content = page.locator("[data-flow-content]");
      await expect(content.getByRole("heading", { name: "Quick Start" })).toBeVisible();
      await expect(content.locator("ol")).toHaveCSS("list-style-type", "decimal");
      await expect(content.locator("ul").first()).toHaveCSS("list-style-type", "disc");
      await expect(content.locator("ul ul")).toHaveCount(1);
      await expect(content.locator("strong")).toHaveCSS("font-weight", "700");
      await expect(content.locator("p code")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(content.locator("pre")).toHaveCSS("white-space", "pre");
      await expect(content.locator("pre")).toHaveCSS("overflow-x", "auto");
      await expect(content.locator("pre")).toHaveCSS("border-width", "0px");
      const sizes = await content.evaluate(element => {
        const style = getComputedStyle(element);
        return { font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
      });
      expect(sizes.line / sizes.font).toBeCloseTo(1.55, 1);
      await page.screenshot({ path: testInfo.outputPath("markdown.png") });
      const preview = await content.evaluate(element => {
        const style = getComputedStyle(element);
        const box = element as HTMLElement;
        return { font: style.fontFamily, size: style.fontSize, line: style.lineHeight, color: style.color, width: box.offsetWidth, height: box.offsetHeight };
      });
      const original = await page.evaluate(() => window.__flowTest.document.guide.$content);
      await content.dblclick();
      const editor = page.getByRole("textbox", { name: "Node content", exact: true });
      await expect(editor).toHaveValue(original);
      await expect(editor).toBeFocused();
      await editor.hover();
      await expect(editor).toHaveCSS("border-width", "0px");
      await expect(editor).toHaveCSS("outline-style", "none");
      await expect(editor).toHaveCSS("box-shadow", "none");
      await expect(editor).toHaveCSS("font-family", preview.font);
      await expect(editor).toHaveCSS("font-size", preview.size);
      await expect(editor).toHaveCSS("line-height", preview.line);
      await expect(editor).toHaveCSS("color", preview.color);
      const editingSize = await editor.evaluate(element => ({ width: element.offsetWidth, height: element.offsetHeight }));
      expect(editingSize.width).toBe(preview.width);
      expect(editingSize.height).toBeGreaterThanOrEqual(preview.height);
      await page.screenshot({ path: testInfo.outputPath("markdown-edit.png") });
      await editor.press("Escape");
      await expect(content).toBeVisible();
      expect(await content.evaluate(element => (element as HTMLElement).offsetHeight)).toBe(preview.height);
      expect(await page.evaluate(() => window.__flowTest.document.guide.$content)).toBe(original);
    });
  }
}