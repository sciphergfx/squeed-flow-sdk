import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

const markdown = [
  "# Runbook",
  "",
  "**Owner:** _Operations_",
  "",
  "- Check the queue",
  "- Restart workers",
  "",
  "| Component | Status |",
  "| --- | --- |",
  "| API | Ready |",
  "",
  "```js",
  'console.log("ready");',
  "```",
  "",
  "[Docs](https://example.com/docs)",
].join("\n");

for (const width of [1440, 390]) {
  test(`Markdown renders and round trips through the source editor at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "?graph=json");
    await page.evaluate(
      (content) =>
        window.__flowTest.replaceDocument({
          runbook: { $label: "Runbook", $content: content },
        }),
      markdown,
    );
    const node = page.locator('.flow-sdk-node[data-node-id="root.runbook"]');
    const body = node.locator("[data-flow-content]");
    await expect(
      body.getByRole("heading", { name: "Runbook", level: 1 }),
    ).toBeVisible();
    await expect(body.locator("strong")).toHaveText("Owner:");
    await expect(body.locator("em")).toHaveText("Operations");
    await expect(body.getByRole("listitem")).toHaveCount(2);
    await expect(body.getByRole("columnheader")).toHaveText([
      "Component",
      "Status",
    ]);
    await expect(body.locator("pre code")).toHaveText('console.log("ready");');
    const link = body.getByRole("link", { name: "Docs" });
    await expect(link).toHaveAttribute("href", "https://example.com/docs");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await link.dispatchEvent("keydown", { key: "Enter", bubbles: true });
    await expect(node.locator("textarea")).toHaveCount(0);
    expect(
      await body.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`markdown-${width}.png`),
    });
    await body.focus();
    await body.press("Enter");
    const editor = node.getByRole("textbox", {
      name: "Node content",
      exact: true,
    });
    await expect(editor).toHaveValue(markdown);
    const next = "## Updated\n\n**Saved** source";
    await editor.fill(next);
    await editor.press("ControlOrMeta+Enter");
    await expect(
      body.getByRole("heading", { name: "Updated", level: 2 }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => window.__flowTest.document.runbook.$content),
    ).toBe(next);
    await body.dblclick();
    await expect(editor).toHaveValue(next);
    await editor.fill("# Cancelled");
    await editor.press("Escape");
    await expect(
      body.getByRole("heading", { name: "Updated", level: 2 }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => window.__flowTest.document.runbook.$content),
    ).toBe(next);
  });
}

test("Markdown does not render executable HTML or unsafe links", async ({
  page,
}) => {
  await ready(page, "?graph=json");
  await page.evaluate(() =>
    window.__flowTest.replaceDocument({
      runbook: {
        $content:
          '<script>window.__markdownExecuted = true</script>\n\n<img src="invalid" onerror="window.__markdownExecuted = true">\n\n<iframe srcdoc="unsafe"></iframe>\n\n[unsafe](javascript:alert(1))',
      },
    }),
  );
  const body = page.locator("[data-flow-content]");
  await expect(body).toBeVisible();
  await expect(
    body.locator("script, iframe, [onerror], [onclick], [href^='javascript:']"),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, "__markdownExecuted")),
  ).toBeUndefined();
});
