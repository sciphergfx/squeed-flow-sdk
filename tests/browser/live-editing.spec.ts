import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("content grows the node while typing without saving until commit", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.__flowTest.replaceGraph({
      nodes: [
        {
          data: {
            id: "runbook",
            type: "objectView",
            label: "Runbook",
            config: { content: "One line" },
          },
        },
      ],
      edges: [],
    }),
  );
  const node = page.locator('.flow-sdk-node[data-node-id="runbook"]');
  await node.locator("[data-flow-content]").dblclick();
  const editor = page.getByRole("textbox", {
    name: "Node content",
    exact: true,
  });
  await expect(editor).toHaveCSS("outline-style", "none");
  await expect(editor).toHaveCSS("box-shadow", "none");
  const initialHeight = await node.evaluate((element) => element.offsetHeight);
  const draft = Array.from(
    { length: 12 },
    (_, index) => `Line ${index + 1}`,
  ).join("\n");
  await editor.fill(draft);
  await expect
    .poll(() => node.evaluate((element) => element.offsetHeight))
    .toBeGreaterThan(initialHeight + 100);
  await expect(editor).toBeFocused();
  expect(
    await editor.evaluate(
      (element: HTMLTextAreaElement) =>
        element.scrollHeight <= element.clientHeight + 1,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "content"),
    ),
  ).toEqual([]);
  await editor.press("Control+Enter");
  await expect(editor).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "content"),
    ),
  ).toEqual([{ name: "content", value: { id: "runbook", content: draft } }]);
});
