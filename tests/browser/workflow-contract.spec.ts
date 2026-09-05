import { expect, test } from "@playwright/test";
import {
  chooseToolbarOption,
  dragBetween,
  expectScrollableToolbar,
  ready,
} from "./helpers";

const schema = {
  type: "object",
  properties: {
    alpha: {
      type: "object",
      properties: { api: { type: "string" }, runtime: { type: "string" } },
      required: ["api", "runtime"],
    },
    beta: {
      type: "object",
      properties: { http: { type: "number" }, ws: { type: "string" } },
      required: ["http", "ws"],
    },
  },
};
const typescript =
  "interface Graph { alpha: Source; beta: Target } interface Source { api: string; runtime: string } interface Target { http: string; ws: string }";

for (const width of [1440, 390]) {
  test(`workflow uploads validate retained connections at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await ready(page, "?graph=connections");
    await page.mouse.click(10, 10);
    const mode = page.getByRole("combobox", { name: "Edge mode", exact: true });
    const upload = page.getByRole("button", {
      name: "Upload workflow interface",
      exact: true,
    });
    const file = page.getByLabel("Workflow interface file", { exact: true });
    await expect(upload).toBeVisible();
    await chooseToolbarOption(mode, "Properties");
    await expect(upload).toBeVisible();
    const palette = page.getByRole("group", {
      name: "Graph theme",
      exact: true,
    });
    expect(
      await palette.evaluate((element) => ({
        divider: element.previousElementSibling?.tagName.toLowerCase(),
        beforeMode: !!(
          element.compareDocumentPosition(
            document.querySelector('[aria-label="Edge mode"]')!,
          ) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
      })),
    ).toEqual({ divider: "svg", beforeMode: true });
    const original = await page.evaluate(() =>
      structuredClone(window.__flowTest.document),
    );
    const count = await page.locator(".flow-sdk-edge").count();
    const edge = page.locator('.flow-sdk-edge[data-source-property="api"]');
    const stroke = await edge.locator("path").first().getAttribute("stroke");
    await file.setInputFiles({
      name: "graph.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(schema)),
    });
    await expect(edge).toHaveAttribute("data-validation", "invalid");
    await expect(edge.locator("path").first()).toHaveAttribute(
      "stroke",
      "#dc2626",
    );
    await expect(
      page.getByRole("img", { name: /Incompatible property types/ }),
    ).toBeAttached();
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      original,
    );
    await expect(page.locator(".flow-sdk-edge")).toHaveCount(count);
    await expectScrollableToolbar(page);
    await upload.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("workflow-validation.png"),
    });
    await file.setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{"),
    });
    await expect(page.getByRole("alert")).toBeAttached();
    await expect(edge).toHaveAttribute("data-validation", "invalid");
    await file.setInputFiles({
      name: "graph.ts",
      mimeType: "text/plain",
      buffer: Buffer.from(typescript),
    });
    await expect(page.locator(".flow-sdk-edge-validation")).toHaveCount(0);
    await expect(edge.locator("path").first()).toHaveAttribute(
      "stroke",
      stroke!,
    );
    await file.setInputFiles({
      name: "missing.ts",
      mimeType: "text/plain",
      buffer: Buffer.from("interface Graph { alpha: { api: string } }"),
    });
    await expect(edge).toHaveAttribute("data-validation", "unverified");
    await expect(edge.locator("path").first()).toHaveAttribute(
      "stroke",
      "#b45309",
    );
    await chooseToolbarOption(mode, "Nodes");
    await expect(upload).toBeVisible();
    await expect(page.locator(".flow-sdk-edge-validation")).toHaveCount(0);
    await chooseToolbarOption(mode, "Properties");
    await expect(edge).toHaveAttribute("data-validation", "unverified");
    await page
      .getByRole("button", { name: "Remove workflow interface", exact: true })
      .click();
    await expect(page.locator(".flow-sdk-edge-validation")).toHaveCount(0);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      original,
    );
    expect(
      await page.evaluate(
        () =>
          window.__flowTest.events.filter(
            (event) => event.name === "workflow-contract",
          ).length,
      ),
    ).toBe(4);
    expect(errors).toEqual([]);
  });
}

test("controlled mode and contract remain authoritative and can be cleared", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() =>
    window.__flowTest.configure({
      edgeMode: "nodes",
      workflowContract: undefined,
    }),
  );
  await page.mouse.click(10, 10);
  const mode = page.getByRole("combobox", { name: "Edge mode", exact: true });
  await chooseToolbarOption(mode, "Properties");
  await expect(mode).toHaveAttribute("title", "Connections: Nodes");
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "properties" }),
  );
  await page
    .getByLabel("Workflow interface file", { exact: true })
    .setInputFiles({
      name: "graph.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(schema)),
    });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__flowTest.events.filter(
            (event) => event.name === "workflow-contract",
          ).length,
      ),
    )
    .toBe(1);
  await expect(page.locator(".flow-sdk-edge-validation")).toHaveCount(0);
  await page.evaluate(() =>
    window.__flowTest.configure({
      workflowContract: window.__flowTest.events.find(
        (event) => event.name === "workflow-contract",
      )!.value as any,
    }),
  );
  await expect(page.locator(".flow-sdk-edge-validation")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Remove workflow interface", exact: true })
    .click();
  await expect(page.locator(".flow-sdk-edge-validation")).toHaveCount(1);
  await page.evaluate(() =>
    window.__flowTest.configure({
      workflowContract: undefined,
      readOnly: true,
    }),
  );
  await expect(page.locator(".flow-sdk-edge-validation")).toHaveCount(0);
  await expect(mode).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Upload workflow interface",
      exact: true,
    }),
  ).toBeDisabled();
});

test("new incompatible mappings remain editable and revalidate after graph changes", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.mouse.click(10, 10);
  await chooseToolbarOption(
    page.getByRole("combobox", { name: "Edge mode", exact: true }),
    "Properties",
  );
  await page
    .getByLabel("Workflow interface file", { exact: true })
    .setInputFiles({
      name: "graph.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(schema)),
    });
  const source = await page
    .locator(
      '[data-node-id="root.alpha"] [data-property="runtime"][data-port-role="source"]',
    )
    .boundingBox();
  const target = await page
    .locator(
      '[data-node-id="root.beta"] [data-property="http"][data-port-role="target"]',
    )
    .boundingBox();
  await dragBetween(
    page,
    { x: source!.x + source!.width / 2, y: source!.y + source!.height / 2 },
    { x: target!.x + target!.width / 2, y: target!.y + target!.height / 2 },
  );
  const edge = page.locator(
    '.flow-sdk-edge[data-source-property="runtime"][data-target-property="http"]',
  );
  await expect(edge).toHaveAttribute("data-validation", "invalid");
  await edge.click();
  await page
    .getByRole("textbox", { name: "Edge label", exact: true })
    .fill("Retained mapping");
  await page
    .getByRole("textbox", { name: "Edge label", exact: true })
    .press("Enter");
  await expect(edge).toHaveAttribute("data-validation", "invalid");
  await page.evaluate(() => {
    const next = structuredClone(window.__flowTest.document) as any;
    next.alpha.$connections.at(-1).targetProperty = "ws";
    window.__flowTest.replaceDocument(next);
  });
  await expect(edge).toHaveCount(0);
  await expect(
    page.locator(
      '.flow-sdk-edge[data-source-property="runtime"][data-validation]',
    ),
  ).toHaveCount(0);
});
