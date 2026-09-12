import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

const variants = [
  { format: "text", icon: "PiTextT" },
  { format: "markdown", icon: "PiMarkdownLogo" },
  { format: "html", icon: "PiFileHtml" },
  { format: "jsx", icon: "PiFileJsx" },
] as const;

for (const format of ["html", "jsx"] as const) {
  test(`headerless ${format} content responds to content size and Fill allocation`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page, "graph=basic-json");
    await page.evaluate((format) => {
      window.__flowTest.configure({
        allNodesIconLabel: false,
        readOnly: true,
        customViews: {
          jsxContent: ({ components }) => window.__flowTest.createElement("div", {
            "data-responsive-grid": "",
            style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, width: 620, maxWidth: "100%" },
          }, ...components.map((component, index) => window.__flowTest.createElement("div", {
            key: index, style: { minHeight: typeof component.height === "number" ? component.height : 80, background: "#d1e6ed" },
          }, String(component.text)))),
        },
      });
      window.__flowTest.replaceDocument({ $hideRoot: true, alpha: {
        $view: "object", $label: "", $borderRadius: 0, $contentFormat: format,
        $content: format === "html"
          ? '<main style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px"><div style="height:80px">First panel</div><div style="height:80px">Second panel</div></main><script>document.body.dataset.untrusted="executed"</script>'
          : [{ type: "text", text: "First panel" }, { type: "text", text: "Second panel" }],
      } });
    }, format);
    const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    const surface = node.locator("[data-flow-node-surface]").first();
    const preview = node.locator("[data-flow-content-preview]");
    const size = () => surface.evaluate(element => ({
      width: element.clientWidth,
      preview: element.querySelector<HTMLElement>("[data-flow-content-preview]")!.clientWidth,
      height: element.clientHeight,
      bounds: element.offsetWidth,
    }));
    await expect(preview).toBeVisible();
    await expect.poll(async () => (await size()).width).toBe(format === "jsx" ? 620 : 300);
    await expect.poll(async () => (await size()).height).toBe(80);
    const desktop = await size();
    const source = await page.evaluate(() => structuredClone(window.__flowTest.document));
    for (const width of [280, 390, 600, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(async () => (await size()).bounds).toBe(Math.min(desktop.bounds, width - 40));
      const current = await size();
      expect(current.preview).toBe(current.width);
      if (format === "jsx") {
        const columns = await node.locator("[data-responsive-grid]").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").filter(track => parseFloat(track) > 0).length);
        expect(columns).toBe(width <= 390 ? 1 : 2);
      } else {
        const frame = page.frameLocator('iframe[title="HTML content preview"]');
        await expect(frame.getByText("Second panel", { exact: true })).toBeVisible();
        const columns = await frame.locator("main").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").filter(track => parseFloat(track) > 0).length);
        expect(columns).toBe(width === 280 ? 1 : 2);
      }
      await expect.poll(async () => (await size()).height).toBe((format === "jsx" ? width <= 390 : width === 280) ? 172 : 80);
      let previous = "";
      let stable = 0;
      await expect.poll(() => node.boundingBox().then(bounds => {
        const current = JSON.stringify(bounds);
        stable = current === previous ? stable + 1 : 0;
        previous = current;
        return stable;
      })).toBeGreaterThanOrEqual(3);
      await page.evaluate(() => window.__flowTest.engine!.centerAndFit(40, false));
      await expect(node).toBeInViewport({ ratio: 0.99 });
      await page.screenshot({ path: test.info().outputPath(`${format}-responsive-${width}.png`) });
    }
    if (format === "html") {
      const iframe = page.locator('iframe[title="HTML content preview"]');
      await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
      const frame = page.frameLocator('iframe[title="HTML content preview"]');
      expect(await frame.locator("body").getAttribute("data-untrusted")).toBeNull();
      expect(await frame.locator("body").evaluate(() => {
        try { return !!parent.document; } catch { return false; }
      })).toBe(false);
      await page.evaluate(() => window.dispatchEvent(new MessageEvent("message", { source: window, data: { type: "squeed:content-size", height: 9000 } })));
      await expect.poll(async () => (await size()).height).toBe(80);
    }
    for (const height of [640, 120]) {
      await page.evaluate(({ format, height }) => {
        const next = structuredClone(window.__flowTest.document);
        next.alpha.$content = format === "html"
          ? `<main style="height:${height}px">Resized content</main>`
          : Array.from({ length: 2 }, () => ({ type: "text", text: "Resized content", height }));
        window.__flowTest.replaceDocument(next);
      }, { format, height });
      await expect.poll(async () => (await size()).height).toBe(height);
    }
    await page.evaluate(source => window.__flowTest.replaceDocument(source), source);
    await expect.poll(async () => (await size()).height).toBe(80);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => window.__flowTest.engine!.setNodeGridMode(true, { fill: true, gaps: 0, animate: false }));
    await expect(node).toHaveAttribute("data-grid-fill");
    await expect.poll(() => node.evaluate(element => {
      const surface = element.querySelector<HTMLElement>("[data-flow-node-surface]")!;
      return Math.abs(surface.offsetWidth - element.clientWidth);
    })).toBeLessThan(1);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(source);
    await page.evaluate(() => window.__flowTest.engine!.setNodeGridMode(false, { animate: false }));
    await expect.poll(async () => (await size()).bounds).toBe(Math.min(desktop.bounds, 350));
    await expect.poll(async () => (await size()).height).toBe(format === "jsx" ? 172 : 80);
  });
}

for (const width of [1440, 390]) {
  for (const format of ["html", "jsx", "markdown"] as const) {
    test(`explicit empty ${format} label controls content header at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, "graph=basic-json");
      await page.evaluate((format) => {
        window.__flowTest.configure({ allNodesIconLabel: false, selectionToolbar: false, editable: true });
        window.__flowTest.replaceDocument({
          $hideRoot: true,
          alpha: {
            $view: "object",
            $label: "",
            $borderRadius: 0,
            $icon: "PiBrowser",
            $contentFormat: format,
            $content: format === "jsx" ? [{ type: "text", text: "Preserved content" }]
              : format === "html" ? "<p>Preserved content</p>" : "Preserved content",
          },
        });
      }, format);
      const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
      const surface = node.locator("[data-flow-node-surface]").first();
      const rows = surface.locator(":scope > div > div");
      const expectedRows = format === "markdown" ? 2 : 1;
      await expect(node.locator("[data-flow-content]")).toBeVisible();
      await expect(rows).toHaveCount(expectedRows);
      await expect(surface).toHaveCSS("border-radius", "0px");
      const source = await page.evaluate(() => structuredClone(window.__flowTest.document));
      await node.hover();
      await expect(rows).toHaveCount(expectedRows);
      if (format !== "markdown") {
        await expect(node.locator("[data-flow-content-toggle]")).toHaveCount(0);
        await expect(node.getByRole("button", { name: "Expand preview", exact: true })).toHaveCount(1);
        const geometry = await surface.evaluate(element => {
          const surface = element.getBoundingClientRect();
          const content = element.querySelector("[data-flow-content-preview]")!.getBoundingClientRect();
          return { topGap: content.top - surface.top, border: parseFloat(getComputedStyle(element).borderTopWidth) };
        });
        expect(geometry.topGap).toBeLessThan(geometry.border + 1);
      }
      await page.screenshot({ path: test.info().outputPath(`${format}-no-label.png`) });
      expect(await page.evaluate(() => window.__flowTest.document)).toEqual(source);
      await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
      await expect(rows).toHaveCount(expectedRows);
      await page.evaluate(() => {
        const next = structuredClone(window.__flowTest.document);
        next.alpha.$label = "Restored title";
        window.__flowTest.replaceDocument(next);
      });
      await expect(rows).toHaveCount(2);
      await expect(node.getByText("Restored title", { exact: true })).toBeVisible();
      await page.evaluate(() => {
        const next = structuredClone(window.__flowTest.document);
        delete next.alpha.$label;
        window.__flowTest.replaceDocument(next);
      });
      await expect(rows).toHaveCount(2);
      await expect(node.getByText("alpha", { exact: true })).toBeVisible();
      if (format !== "markdown") {
        await page.evaluate(() => {
          const next = structuredClone(window.__flowTest.document);
          next.alpha.$label = "";
          window.__flowTest.replaceDocument(next);
          window.__flowTest.configure({ nodeViewModes: { "root.alpha": "properties" } });
        });
        await expect(node.locator("[data-flow-content-preview]")).toHaveCount(0);
        await expect(rows.first()).toHaveCSS("border-bottom-width", "1px");
        await page.evaluate(() => window.__flowTest.configure({ nodeViewModes: { "root.alpha": "default" } }));
        await expect(rows).toHaveCount(1);
        await expect(node.locator("[data-flow-content-preview]")).toBeVisible();
      }
    });
  }
  test(`Text dot and text-only content form at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "graph=basic-json");
    await page.evaluate(() => {
      window.__flowTest.configure({ editable: true, readOnly: false, allNodesIconLabel: false, selectionToolbar: false });
      window.__flowTest.replaceDocument({ $hideRoot: true,
        alpha: { $view: "text", $label: "Editable text", $icon: "PiCalendar", $bgColor: "teal.700" },
      });
    });
    const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    await expect(node.getByText("Editable text", { exact: true })).toBeVisible();
    const source = await page.evaluate(() => structuredClone(window.__flowTest.document));
    await node.getByText("Editable text", { exact: true }).dblclick();
    const form = page.getByRole("dialog", { name: "Configure Editable text", exact: true });
    const input = form.getByRole("textbox", { name: "Node content", exact: true });
    await expect(form).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("Editable text");
    await expect(form.locator('input, select, [data-form-field], [data-flow-form]')).toHaveCount(0);
    await input.fill("First line");
    await input.press("End");
    await input.press("Enter");
    await input.pressSequentially("Second line");
    await expect(input).toHaveValue("First line\nSecond line");
    await page.screenshot({ path: test.info().outputPath("text-form.png") });
    await input.press("Control+Enter");
    await expect(form).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__flowTest.document.alpha.$label)).toBe("First line\nSecond line");
    await node.getByText("First line Second line", { exact: true }).dblclick();
    const edit = page.getByRole('dialog').getByRole('textbox', { name: 'Node content', exact: true });
    await expect(edit).toHaveValue("First line\nSecond line");
    await edit.fill("Cancelled");
    await edit.press("Escape");
    await expect.poll(() => page.evaluate(() => window.__flowTest.document.alpha.$label)).toBe("First line\nSecond line");
    await node.getByText("First line Second line", { exact: true }).dblclick();
    await edit.fill("Editable text");
    await page.getByRole('dialog').getByRole('button', { name: 'Close node configuration', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__flowTest.document)).toEqual(source);
    for (let cycle = 0; cycle < 2; cycle++) {
      await node.getByText("Editable text", { exact: true }).hover();
      await node.getByRole("button", { name: "Show icon", exact: true }).click();
      await expect(node.locator("[data-flow-icon-label]")).toBeVisible();
      await node.getByRole("button", { name: "Show text", exact: true }).click();
      await expect(node.locator("[data-flow-icon-label]")).toHaveCount(0);
      expect(await page.evaluate(() => window.__flowTest.document)).toEqual(source);
    }
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await node.getByText("Editable text", { exact: true }).dblclick();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.evaluate(() => window.__flowTest.configure({ readOnly: false, editable: false }));
    await node.getByText("Editable text", { exact: true }).dblclick();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
  for (const variant of variants) {
    test(`${variant.format} default compact icon and restore at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, "graph=basic-json");
      await page.evaluate(({ format, icon }) => {
        window.__flowTest.configure({ allNodesIconLabel: false, selectionToolbar: false, bottomBarCollapsed: false });
        const content = format === "text" ? {} : {
          $contentFormat: format,
          $content: format === "jsx" ? [{ type: "text", text: "Preserved content" }] : format === "html" ? "<p>Preserved content</p>" : "Preserved content",
        };
        window.__flowTest.replaceDocument({
          $hideRoot: true,
          alpha: { $view: format === "text" ? "text" : "object", $label: "Default icon", ...content },
          custom: { $view: format === "text" ? "text" : "object", $label: "Custom icon", $icon: "PiCalendar", ...content },
          reference: { $view: "icon-label", $label: "Icon reference", $icon: icon },
          customReference: { $view: "icon-label", $label: "Custom reference", $icon: "PiCalendar" },
        });
      }, variant);
      const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
      const custom = page.locator('.flow-sdk-node[data-node-id="root.custom"]');
      const reference = page.locator('.flow-sdk-node[data-node-id="root.reference"]');
      const customReference = page.locator('.flow-sdk-node[data-node-id="root.customReference"]');
      const surfaceIcon = "[data-flow-node-surface] svg";
      await expect(node.getByText("Default icon", { exact: true })).toBeVisible();
      await expect(reference.locator(surfaceIcon)).toHaveCount(1);
      const expectedIcon = await reference.locator(surfaceIcon).innerHTML();
      const expectedCustomIcon = await customReference.locator(surfaceIcon).innerHTML();
      const source = await page.evaluate(() => JSON.stringify(window.__flowTest.document));
      await node.getByText("Default icon", { exact: true }).click();
      for (let cycle = 0; cycle < 3; cycle++) {
        await page.keyboard.press("Enter");
        await expect(node.locator("[data-flow-icon-label]")).toBeVisible();
        await page.keyboard.press("Enter");
        await expect(node.locator("[data-flow-icon-label]")).toHaveCount(0);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        if (variant.format !== "text") await expect(node.locator("[data-flow-content]")).toBeVisible();
        expect(await page.evaluate(() => JSON.stringify(window.__flowTest.document))).toBe(source);
      }
      await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
      await page.keyboard.press("Enter");
      await expect(node.locator("[data-flow-icon-label]")).toHaveCount(0);
      await page.evaluate(() => window.__flowTest.configure({ readOnly: false }));
      const toggle = page.getByRole("button", { name: "Collapse all", exact: true });
      for (let cycle = 0; cycle < 2; cycle++) {
        await toggle.scrollIntoViewIfNeeded();
        await toggle.click();
        await expect(node.locator("[data-flow-icon-label]")).toBeVisible();
        await expect(node.locator("[data-flow-icon-caption]")).toHaveText("Default icon");
        await expect(node.locator(surfaceIcon)).toHaveCount(1);
        expect(await node.locator(surfaceIcon).innerHTML()).toBe(expectedIcon);
        expect(await custom.locator(surfaceIcon).innerHTML()).toBe(expectedCustomIcon);
        await expect(node.locator("[data-flow-content]")).toHaveCount(0);
        await page.screenshot({ path: test.info().outputPath(`compact-${cycle}.png`) });
        await node.getByText("Default icon", { exact: true }).click();
        await node.getByRole("button", { name: variant.format === "text" ? "Show text" : "Show properties", exact: true }).click();
        await expect(node.locator("[data-flow-icon-label]")).toHaveCount(0);
        await expect(node.getByText("Default icon", { exact: true })).toBeVisible();
        if (variant.format === "text") await expect(node.locator(surfaceIcon)).toHaveCount(0);
        else await expect(node.locator("[data-flow-content]")).toBeVisible();
        await toggle.scrollIntoViewIfNeeded();
        await toggle.click();
        await expect(custom.locator("[data-flow-icon-label]")).toHaveCount(0);
        expect(await page.evaluate(() => JSON.stringify(window.__flowTest.document))).toBe(source);
      }
    });
  }
}