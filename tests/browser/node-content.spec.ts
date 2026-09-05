import { expect, test } from "@playwright/test";
import { clearEvents, ready } from "./helpers";

test("content can be cleared, reopened and cancelled without losing the view", async ({
  page,
}) => {
  await ready(page, "?graph=json");
  await page.evaluate(() =>
    window.__flowTest.replaceDocument({
      runbook: { $label: "Runbook", $content: "Original" },
    }),
  );
  const node = page.locator('.flow-sdk-node[data-node-id="root.runbook"]');
  const body = node.locator("[data-flow-content]");
  await body.dblclick();
  const input = node.getByRole("textbox", {
    name: "Node content",
    exact: true,
  });
  await input.fill("");
  await page.mouse.click(10, 10);
  await expect(body).toBeVisible();
  await expect(body).toHaveText("");
  expect(
    await page.evaluate(() => window.__flowTest.document.runbook.$content),
  ).toBe("");
  await body.dblclick();
  await input.fill("Cancelled");
  await input.press("Escape");
  await expect(body).toHaveText("");
  await body.press("Enter");
  await input.fill("Reopened");
  await input.press("ControlOrMeta+Enter");
  await expect(body).toHaveText("Reopened");
});

for (const width of [1440, 390]) {
  test(`content uses object minimum width and a right-aligned view switch at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "?graph=json");
    await page.evaluate(() =>
      window.__flowTest.replaceDocument({
        runbook: { $label: "Runbook", $content: "Short", status: "ready" },
        object: { $label: "Object", status: "ready" },
      }),
    );
    const node = page.locator('.flow-sdk-node[data-node-id="root.runbook"]');
    const reference = page.locator(
      '.flow-sdk-node[data-node-id="root.object"]',
    );
    await expect(node.locator("[data-flow-content]")).toHaveText("Short");
    const initial = await node.evaluate(
      (element: HTMLElement) => element.offsetWidth,
    );
    expect(initial).toBeGreaterThanOrEqual(806);
    expect(initial).toBe(
      await reference.evaluate((element: HTMLElement) => element.offsetWidth),
    );
    const alignmentError = await node
      .locator("[data-flow-content-toggle]")
      .evaluate((element) => {
        const header = element.parentElement!;
        const bounds = header.getBoundingClientRect();
        const scale = bounds.width / header.offsetWidth;
        return Math.abs(
          element.getBoundingClientRect().right -
            (bounds.right -
              parseFloat(getComputedStyle(header).paddingRight) * scale),
        );
      });
    expect(alignmentError).toBeLessThan(0.5);
    const before = await page.evaluate(() => window.__flowTest.document);
    await node
      .getByRole("button", { name: "Show properties", exact: true })
      .click();
    await expect(node.locator("[data-flow-property]")).toHaveCount(1);
    expect(
      await node.evaluate((element: HTMLElement) => element.offsetWidth),
    ).toBe(initial);
    await node
      .getByRole("button", { name: "Show content", exact: true })
      .click();
    await expect(node.locator("[data-flow-content]")).toHaveText("Short");
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      before,
    );
    await page.screenshot({
      path: testInfo.outputPath(`runbook-${width}.png`),
    });
  });
}

test("raw content edits emit a dedicated callback and preserve config", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.__flowTest.replaceGraph({
      nodes: [
        {
          data: {
            id: "alpha",
            type: "objectView",
            label: "Runbook",
            config: { content: "Before", icon: "PiBookOpen" },
          },
        },
      ],
      edges: [],
    }),
  );
  const node = page.locator('.flow-sdk-node[data-node-id="alpha"]');
  await node.locator("[data-flow-content]").dblclick();
  await clearEvents(page);
  const input = node.getByRole("textbox", {
    name: "Node content",
    exact: true,
  });
  await input.fill("After\nNext");
  await input.press("ControlOrMeta+Enter");
  await expect(node.locator("[data-flow-content]")).toHaveText("After\nNext");
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) =>
        ["content", "json", "label"].includes(event.name),
      ),
    ),
  ).toEqual([
    { name: "content", value: { id: "alpha", content: "After\nNext" } },
  ]);
  await expect(node.locator('svg[width="64"]')).toHaveCount(1);
});

test("read-only content and editable=false do not open the editor", async ({
  page,
}) => {
  await ready(page, "?graph=json");
  await page.evaluate(() =>
    window.__flowTest.replaceDocument({
      runbook: { $label: "Runbook", $content: "Read me" },
    }),
  );
  const node = page.locator('.flow-sdk-node[data-node-id="root.runbook"]');
  const body = node.locator("[data-flow-content]");
  for (const config of [
    { readOnly: true },
    { readOnly: false, editable: false },
  ]) {
    await page.evaluate(
      (config) => window.__flowTest.configure(config),
      config,
    );
    await body.dblclick();
    await expect(node.locator("textarea")).toHaveCount(0);
  }
  await page.evaluate(() => window.__flowTest.configure({ editable: true }));
  await body.dblclick();
  const input = node.getByRole("textbox", {
    name: "Node content",
    exact: true,
  });
  await expect(input).toBeFocused();
  await input.fill("Not saved");
  await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
  await expect(input).toHaveCount(0);
  expect(
    await page.evaluate(() => window.__flowTest.document.runbook.$content),
  ).toBe("Read me");
});

test("Runbook content edits multiline text and saves without changing its title", async ({
  page,
}) => {
  await ready(page, "?graph=json");
  const original = "1. Check queue depth\n2. Restart workers";
  await page.evaluate(
    (content) =>
      window.__flowTest.replaceDocument({
        runbook: { $label: "Runbook", $content: content, status: "ready" },
      }),
    original,
  );
  const node = page.locator('.flow-sdk-node[data-node-id="root.runbook"]');
  await node.locator("[data-flow-content]").dblclick();
  const input = node.getByRole("textbox", {
    name: "Node content",
    exact: true,
  });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(original);
  await clearEvents(page);
  await input.fill("  First step");
  await input.press("End");
  await input.press("Enter");
  await input.pressSequentially("Second step");
  await expect(input).toHaveValue("  First step\nSecond step");
  await input.press("ControlOrMeta+Enter");
  await expect(input).toHaveCount(0);
  await expect(node.locator("[data-flow-content]")).toHaveText(
    "  First step\nSecond step",
  );
  expect(await page.evaluate(() => window.__flowTest.document.runbook)).toEqual(
    {
      $label: "Runbook",
      $content: "  First step\nSecond step",
      status: "ready",
    },
  );
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "json"),
    ),
  ).toHaveLength(1);
});
