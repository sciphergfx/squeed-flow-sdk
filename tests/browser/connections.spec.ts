import { expect, test, type Page } from "@playwright/test";
import { clearEvents, dragBetween, ready } from "./helpers";

test("global draw mode maps row bodies and disabling handles stops drawing", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() =>
    window.__flowTest.configure({
      edgeMode: "properties",
      isEdgeHandlesEnabled: true,
    }),
  );
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(8);
  const points = await page.evaluate(() => {
    const center = (node: string, property: string) => {
      const row = document
        .querySelector(
          `.flow-sdk-node[data-node-id="${node}"] [data-flow-property="${property}"]`,
        )!
        .getBoundingClientRect();
      return { x: row.x + row.width / 2, y: row.y + row.height / 2 };
    };
    return {
      source: center("root.alpha", "api"),
      target: center("root.beta", "ws"),
    };
  });
  await dragBetween(page, points.source, points.target);
  await expect
    .poll(() =>
      page.evaluate(() => window.__flowTest.document.alpha.$connections.length),
    )
    .toBe(3);
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeHandles: false }),
  );
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(0);
  await expect(page.locator(".flow-sdk-canvas")).not.toHaveClass(
    /flow-sdk-draw/,
  );
  await clearEvents(page);
  await dragBetween(page, points.source, points.target);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "create-edge"),
    ),
  ).toEqual([]);
});

test("hidden rows fall back to node endpoints and restore without losing mappings", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "properties" }),
  );
  await expect.poll(() => rowAttachmentError(page)).toBeLessThan(0.2);
  const original = await page.evaluate(() => window.__flowTest.document);
  await page.evaluate(() => {
    const current = window.__flowTest.document;
    window.__flowTest.replaceDocument({
      ...current,
      beta: { ...current.beta, $content: "HTTP and WebSocket handlers" },
    });
  });
  await expect(
    page.locator(
      '.flow-sdk-node[data-node-id="root.beta"] [data-flow-property]',
    ),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const edge = document.querySelector(
          '.flow-sdk-edge[data-source-property="api"]',
        )!;
        const arrow = edge.querySelectorAll(":scope > path")[1];
        const coordinates = arrow
          .getAttribute("d")!
          .match(/-?\d+(?:\.\d+)?/g)!
          .map(Number);
        return Math.abs(
          coordinates[1] - window.__flowTest.engine!.getNodeBox("root.beta")!.y,
        );
      }),
    )
    .toBeLessThan(0.1);
  expect(
    await page.evaluate(() => window.__flowTest.document.alpha.$connections),
  ).toEqual(original.alpha.$connections);
  await page.evaluate(
    (document) => window.__flowTest.replaceDocument(document),
    original,
  );
  await expect.poll(() => rowAttachmentError(page)).toBeLessThan(0.2);
  await page.evaluate(() => window.__flowTest.mount(false));
  await expect(page.locator(".flow-sdk-canvas")).toHaveCount(0);
  await page.evaluate(() => window.__flowTest.mount(true));
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(8);
  await expect.poll(() => rowAttachmentError(page)).toBeLessThan(0.2);
});

for (const direction of ["TB", "BT"] as const) {
  test(`${direction} keeps property arrows on the matching rows`, async ({
    page,
  }) => {
    await ready(page, "?graph=connections");
    await page.evaluate(
      (direction) =>
        window.__flowTest.configure({ edgeMode: "properties", direction }),
      direction,
    );
    await expect
      .poll(() =>
        page.evaluate((direction) => {
          const engine = window.__flowTest.engine!;
          return (
            (engine.getNodeBox("root.beta")!.y -
              engine.getNodeBox("root.alpha")!.y) *
            (direction === "TB" ? 1 : -1)
          );
        }, direction),
      )
      .toBeGreaterThan(0);
    await expect.poll(() => rowAttachmentError(page)).toBeLessThan(0.2);
  });
}

test("raw graph callbacks include property references without a JSON callback", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    window.__flowTest.replaceGraph({
      nodes: [
        {
          data: {
            id: "alpha",
            type: "objectView",
            headerTitle: "Source",
            description: { output: "value" },
          },
        },
        {
          data: {
            id: "beta",
            type: "objectView",
            headerTitle: "Target",
            description: { input: "value" },
          },
        },
      ],
      edges: [{ data: { id: "plain", source: "alpha", target: "beta" } }],
    });
    window.__flowTest.configure({ edgeMode: "properties" });
  });
  const source = await portCenter(page, "alpha", "output", "source");
  const target = await portCenter(page, "beta", "input", "target");
  await clearEvents(page);
  await dragBetween(page, source, target);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter(
        (event) => event.name === "create-edge" || event.name === "json",
      ),
    ),
  ).toEqual([
    {
      name: "create-edge",
      value: {
        source: "alpha",
        target: "beta",
        sourceProperty: "output",
        targetProperty: "input",
      },
    },
  ]);
});

test("switching edge mode cancels an active property drag", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "properties" }),
  );
  const source = await portCenter(page, "root.alpha", "api", "source");
  const target = await portCenter(page, "root.beta", "ws", "target");
  await clearEvents(page);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await expect(page.locator(".flow-sdk-ghost")).toHaveCount(1);
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "workflow" }),
  );
  await expect(page.locator(".flow-sdk-ghost")).toHaveCount(0);
  await page.mouse.up();
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter(
        (event) => event.name === "create-edge" || event.name === "json",
      ),
    ),
  ).toEqual([]);
});

test.describe("mobile property ports", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("touch dragging saves a mapping in dark mode", async ({
    page,
    context,
  }, testInfo) => {
    await ready(page, "?graph=connections");
    await page.evaluate(() =>
      window.__flowTest.configure({
        edgeMode: "properties",
        colorMode: "dark",
      }),
    );
    const source = await portCenter(page, "root.alpha", "api", "source");
    const target = await portCenter(page, "root.beta", "ws", "target");
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...source, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...target, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__flowTest.document.alpha.$connections.length,
        ),
      )
      .toBe(3);
    await expect(page.locator(".flow-sdk-ghost")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("properties-mobile.png"),
    });
  });
});

async function rowAttachmentError(page: Page, reverse = false) {
  return page.evaluate((reverse) => {
    const engine = window.__flowTest.engine!;
    const edge = document.querySelector<SVGGElement>(
      '.flow-sdk-edge[data-source-property="api"]',
    )!;
    if (!edge) return Infinity;
    const line = edge.querySelector<SVGPathElement>(":scope > path")!;
    const arrow = edge.querySelectorAll<SVGPathElement>(":scope > path")[1];
    const source = line
      .getPointAtLength(0)
      .matrixTransform(line.getScreenCTM()!);
    const [arrowX, arrowY] = arrow
      .getAttribute("d")!
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number);
    const target = new DOMPoint(arrowX, arrowY).matrixTransform(
      arrow.getScreenCTM()!,
    );
    const sourceNode = document.querySelector(
      '.flow-sdk-node[data-node-id="root.alpha"]',
    )!;
    const targetNode = document.querySelector(
      '.flow-sdk-node[data-node-id="root.beta"]',
    )!;
    const sourceRow = sourceNode
      .querySelector('[data-flow-property="api"]')!
      .getBoundingClientRect();
    const targetRow = targetNode
      .querySelector('[data-flow-property="http"]')!
      .getBoundingClientRect();
    const sourceBounds = sourceNode.getBoundingClientRect();
    const targetBounds = targetNode.getBoundingClientRect();
    const gap = 18 * engine.zoom();
    return Math.max(
      Math.abs(source.y - (sourceRow.top + sourceRow.height / 2)),
      Math.abs(target.y - (targetRow.top + targetRow.height / 2)),
      Math.abs(
        source.x -
          (reverse ? sourceBounds.left - gap : sourceBounds.right + gap),
      ),
      Math.abs(
        target.x -
          (reverse ? targetBounds.right + gap : targetBounds.left - gap),
      ),
    );
  }, reverse);
}

test("property mode attaches mappings to rows without changing graph or JSON", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "?graph=connections");
  const before = await page.evaluate(() => window.__flowTest.document);
  const edgeIds = await page
    .locator(".flow-sdk-edges > .flow-sdk-edge")
    .evaluateAll((edges) =>
      edges.map((edge) => edge.getAttribute("data-edge-id")),
    );
  const mapping = page.locator('.flow-sdk-edge[data-source-property="api"]');
  const workflowPath = await mapping
    .locator(":scope > path")
    .first()
    .getAttribute("d");
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(0);
  await clearEvents(page);
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "properties" }),
  );
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(8);
  await expect.poll(() => rowAttachmentError(page)).toBeLessThan(0.2);
  expect(
    await mapping.locator(":scope > path").first().getAttribute("d"),
  ).not.toBe(workflowPath);
  expect(
    await page
      .locator(".flow-sdk-edges > .flow-sdk-edge")
      .evaluateAll((edges) =>
        edges.map((edge) => edge.getAttribute("data-edge-id")),
      ),
  ).toEqual(edgeIds);
  expect(await page.evaluate(() => window.__flowTest.document)).toEqual(before);
  await page.screenshot({
    path: testInfo.outputPath("properties-desktop.png"),
  });
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "workflow" }),
  );
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(0);
  await expect(mapping.locator(":scope > path").first()).toHaveAttribute(
    "d",
    workflowPath!,
  );
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter(
        (event) => event.name === "json" || event.name === "remove-edge",
      ),
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test("row anchors follow resizing, zoom, pan and reversed flow", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() =>
    window.__flowTest.configure({
      edgeMode: "properties",
      nodeAlignment: "leading",
    }),
  );
  await expect.poll(() => rowAttachmentError(page)).toBeLessThan(0.2);
  await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>(
      '.flow-sdk-node[data-node-id="root.alpha"] [data-flow-property="runtime"]',
    )!;
    row.style.minHeight = "240px";
    window.__flowTest.engine!.zoom(0.3);
    window.__flowTest.engine!.pan({ x: 85, y: 95 });
  });
  await expect.poll(() => rowAttachmentError(page)).toBeLessThan(0.2);
  await page.evaluate(() => window.__flowTest.configure({ direction: "RL" }));
  await expect.poll(() => rowAttachmentError(page, true)).toBeLessThan(0.2);
});

async function portCenter(
  page: Page,
  nodeId: string,
  property: string,
  role: "source" | "target",
) {
  const port = page.locator(
    `.flow-sdk-node[data-node-id="${nodeId}"] .flow-sdk-property-port[data-property="${property}"][data-port-role="${role}"]`,
  );
  await expect(port).toBeVisible();
  await port.hover();
  const bounds = await port.boundingBox();
  return {
    x: bounds!.x + bounds!.width / 2,
    y: bounds!.y + bounds!.height / 2,
  };
}

test("dragging property ports appends one mapping and edits only that mapping", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "properties" }),
  );
  const source = await portCenter(page, "root.alpha", "api", "source");
  const target = await portCenter(page, "root.beta", "ws", "target");
  await clearEvents(page);
  await dragBetween(page, source, target);
  await expect
    .poll(() =>
      page.evaluate(() => window.__flowTest.document.alpha.$connections.length),
    )
    .toBe(3);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter((event) => event.name === "create-edge"),
    ),
  ).toEqual([
    {
      name: "create-edge",
      value: {
        source: "root.alpha",
        target: "root.beta",
        sourceProperty: "api",
        targetProperty: "ws",
      },
    },
  ]);
  const mapping = page.locator(
    '.flow-sdk-edge[data-source-property="api"][data-target-property="ws"]',
  );
  await mapping.click();
  const label = page.getByRole("textbox", { name: "Edge label", exact: true });
  await label.fill("response");
  await label.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__flowTest.document.alpha.$connections[2].label,
      ),
    )
    .toBe("response");
  await page.getByRole("button", { name: "Delete edge", exact: true }).click();
  await expect(mapping).toHaveCount(0);
  expect(
    await page.evaluate(() => window.__flowTest.document.alpha),
  ).toMatchObject({
    $target: "root.gamma",
    $connections: [
      { sourceProperty: "api", target: "root.beta", targetProperty: "http" },
      { sourceProperty: "runtime", target: "root.beta", targetProperty: "ws" },
    ],
  });
});

test("property draw cancellation, empty drops and read-only create nothing", async ({
  page,
}) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeMode: "properties" }),
  );
  const source = await portCenter(page, "root.alpha", "api", "source");
  const target = await portCenter(page, "root.beta", "ws", "target");
  await clearEvents(page);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await expect(page.locator(".flow-sdk-ghost")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await dragBetween(page, source, { x: 20, y: 20 });
  await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
  await expect(page.locator(".flow-sdk-property-port")).toHaveCount(0);
  await dragBetween(page, source, target);
  await expect(page.locator(".flow-sdk-ghost")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.__flowTest.events.filter(
        (event) => event.name.startsWith("create-") || event.name === "json",
      ),
    ),
  ).toEqual([]);
  await expect.poll(() => rowAttachmentError(page)).toBeLessThan(0.2);
});
