import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`content gallery dimensions and document-order slides at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await ready(page, "graph=basic-json");
    await page.evaluate(() => {
      window.__flowTest.configure({ editable: true, allNodesIconLabel: false, selectionToolbar: false, customViews: {
        jsxContent: ({ components }) => window.__flowTest.createElement("div", { "data-gallery-jsx": "", style: { width: "100%", minHeight: 100, background: "#d1e6ed" } },
          ...components.map((component, index) => window.__flowTest.createElement("p", { key: index }, String(component.text)))),
      } });
      window.__flowTest.replaceDocument({ $hideRoot: true,
        alpha: { $view: "object", $label: "", $width: 300, $height: 400, $contentFormat: "html", $content: '<main style="background:#cce4d5;height:100%"><h1>First HTML</h1></main>' },
        skipped: { $view: "object", $label: "Notes", $content: "Markdown is not a slide." },
        second: { $view: "object", $label: "Second", $contentFormat: "jsx", $content: [{ type: "text", text: "Second JSX" }] },
        third: { $view: "object", $label: "Third", $contentFormat: "html", $content: "<h1>Third HTML</h1>" },
      });
    });
    const node = page.locator('[data-node-id="root.alpha"]');
    const expand = node.getByRole("button", { name: "Expand preview", exact: true });
    await expand.focus();
    await expand.press("Enter");
    const gallery = page.locator("[data-content-gallery]");
    const slide = gallery.locator("[data-content-slide]");
    const tools = gallery.getByRole("toolbar", { name: "Preview controls", exact: true });
    const previous = tools.getByRole("button", { name: "Previous content", exact: true });
    const next = tools.getByRole("button", { name: "Next content", exact: true });
    const widthInput = tools.getByRole("spinbutton", { name: "Content width", exact: true });
    const heightInput = tools.getByRole("spinbutton", { name: "Content height", exact: true });
    await expect(gallery).toBeVisible();
    await expect(gallery).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(tools).toHaveCSS("position", "absolute");
    expect((await gallery.locator('[data-content-slide-viewport]').boundingBox())!.y).toBe((await gallery.boundingBox())!.y);
    await expect(tools.locator('div:has(> [data-flow-toolbar-scroll])')).toHaveCSS("border-radius", "30px");
    await expect(slide).toHaveAttribute("data-content-slide", "root.alpha");
    await expect(previous).toBeDisabled();
    await expect(widthInput).toHaveValue("300");
    await expect(heightInput).toHaveValue("400");
    await expect(slide).toHaveCSS("width", "300px");
    await expect(slide).toHaveCSS("height", "400px");
    await expect(gallery.frameLocator("iframe").getByText("First HTML", { exact: true })).toBeVisible();
    const owner = await page.evaluate(() => {
      const element = document.fullscreenElement;
      element!.setAttribute("data-original-fullscreen", "");
      return window.__flowTest.document;
    });
    await widthInput.fill("320");
    await widthInput.press("Enter");
    await heightInput.fill("480");
    await heightInput.press("Enter");
    await expect.poll(() => page.evaluate(() => [window.__flowTest.document.alpha.$width, window.__flowTest.document.alpha.$height])).toEqual([320, 480]);
    await expect(slide).toHaveCSS("width", "320px");
    await expect(slide).toHaveCSS("height", "480px");
    await widthInput.fill("-1");
    await widthInput.press("Enter");
    await expect(widthInput).toHaveValue("320");
    await next.click();
    await expect(slide).toHaveAttribute("data-content-slide", "root.second");
    await expect(slide.getByText("Second JSX", { exact: true })).toBeVisible();
    await expect(widthInput).toHaveValue("");
    await expect(heightInput).toHaveValue("");
    await widthInput.fill("280");
    await widthInput.press("Enter");
    await heightInput.fill("360");
    await heightInput.press("Enter");
    await expect(slide).toHaveCSS("width", "280px");
    await expect(slide).toHaveCSS("height", "360px");
    await widthInput.fill("500");
    await widthInput.press("Escape");
    await expect(widthInput).toHaveValue("280");
    expect(await page.evaluate(() => document.fullscreenElement?.hasAttribute("data-original-fullscreen"))).toBe(true);
    await tools.getByRole("button", { name: "Edit content source", exact: true }).scrollIntoViewIfNeeded();
    await tools.getByRole("button", { name: "Edit content source", exact: true }).click();
    const editor = slide.getByRole("textbox", { name: "Node content", exact: true });
    await expect(editor).toBeFocused();
    await expect(next).toBeDisabled();
    await editor.fill('[{"type":"text","text":"Updated second"}]');
    await editor.press("Control+Enter");
    await expect(slide.getByText("Updated second", { exact: true })).toBeVisible();
    await tools.getByRole("button", { name: "Edit content source", exact: true }).click();
    await editor.fill('[{"type":"text","text":"Discarded draft"}]');
    await editor.press("Escape");
    await expect(slide.getByText("Updated second", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.fullscreenElement?.hasAttribute("data-original-fullscreen"))).toBe(true);
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await expect(slide).toHaveAttribute("data-content-slide", "root.third");
    await expect(next).toBeDisabled();
    await expect(gallery.frameLocator("iframe").getByText("Third HTML", { exact: true })).toBeVisible();
    await slide.evaluate(async element => {
      await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined)));
    });
    await page.screenshot({ path: test.info().outputPath(`content-gallery-${width}.png`) });
    await previous.click();
    await expect(widthInput).toHaveValue("280");
    await expect(heightInput).toHaveValue("360");
    await widthInput.fill("");
    await widthInput.press("Enter");
    await heightInput.fill("");
    await heightInput.press("Enter");
    await expect.poll(() => page.evaluate(() => [window.__flowTest.document.second.$width, window.__flowTest.document.second.$height])).toEqual([undefined, undefined]);
    expect(await page.evaluate(() => document.fullscreenElement?.hasAttribute("data-original-fullscreen"))).toBe(true);
    await previous.click();
    await expect(widthInput).toHaveValue("320");
    await expect(heightInput).toHaveValue("480");
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(widthInput).toBeDisabled();
    await expect(heightInput).toBeDisabled();
    await expect(tools.getByRole("button", { name: "Edit content source", exact: true })).toHaveCount(0);
    await next.click();
    await expect(slide).toHaveAttribute("data-content-slide", "root.second");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await next.click();
    expect(await slide.evaluate(element => element.getAnimations().length)).toBe(0);
    const exit = node.getByRole("button", { name: "Exit fullscreen", exact: true });
    await expect(gallery.getByRole("button", { name: "Exit fullscreen", exact: true })).toHaveCount(0);
    await expect(exit).toBeInViewport({ ratio: 1 });
    expect((await tools.boundingBox())!.x + (await tools.boundingBox())!.width).toBeLessThan((await exit.boundingBox())!.x);
    await exit.click();
    await expect(gallery).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await expect(node.locator("[data-flow-content-preview]").first()).toHaveCSS("height", "480px");
    await expect(node.locator("[data-flow-node-surface]").first()).toHaveCSS("width", "320px");
    const saved = await page.evaluate(() => window.__flowTest.document);
    expect(saved.alpha).toEqual({ ...owner.alpha, $width: 320, $height: 480 });
    expect(saved.skipped).toEqual(owner.skipped);
    expect(saved.third).toEqual(owner.third);
    expect(await page.evaluate(() => window.__flowTest.events.filter(event => event.name === "select-node"))).toEqual([]);
    expect(errors).toEqual([]);
  });
}