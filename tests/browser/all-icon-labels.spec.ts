import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`Shift content editing preserves focus and permissions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "graph=basic-json");
    await page.evaluate(() => {
      window.__flowTest.configure({ editable: true, readOnly: true, allNodesIconLabel: false, nodeViewModes: { "root.alpha": "default" }, nodeGrid: { enabled: true, options: { fill: false } } });
      window.__flowTest.replaceDocument({ $hideRoot: true, alpha: { $view: "object", $label: "Content", $content: "Original content" } });
    });
    const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    const preview = node.locator("[data-flow-content]");
    const input = node.getByRole("textbox", { name: "Node content", exact: true });
    await expect(preview).toHaveText("Original content");
    await preview.click({ modifiers: ["Shift"] });
    await expect(input).toHaveCount(0);
    await page.evaluate(() => window.__flowTest.configure({ readOnly: false, editable: false }));
    await preview.click({ modifiers: ["Shift"] });
    await expect(input).toHaveCount(0);
    await page.evaluate(() => window.__flowTest.configure({ editable: true }));
    await preview.click({ modifiers: ["Shift"] });
    await expect(input).toBeFocused();
    await input.fill("Unsaved draft");
    await page.evaluate(() => window.__flowTest.replaceDocument({ ...window.__flowTest.document, alpha: { ...window.__flowTest.document.alpha, $label: "Updated label" } }));
    await expect(node.getByText("Updated label", { exact: true })).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("Unsaved draft");
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(input).toHaveCount(0);
    await expect(preview).toHaveText("Original content");
  });
}

for (const width of [1440, 390]) {
  for (const direction of ["TB", "BT", "LR", "RL"] as const) {
    test(`icon captions clear edges in ${direction} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, "graph=basic-json");
      await page.evaluate((direction) => {
        window.__flowTest.configure({
          direction,
          edgeMode: "auto",
          edgeReveal: false,
        });
        window.__flowTest.replaceDocument({
          $hideRoot: true,
          analysis: {
            $view: "icon-label",
            $label: "Analysis Agent",
            $icon: "PiChartBar",
            $connections: [{ target: "root.library" }],
          },
          library: {
            $view: "icon-label",
            $label: "Knowledge Library",
            $icon: "PiBooks",
          },
        });
      }, direction);
      const captions = page.locator("[data-flow-icon-caption]");
      await expect(captions).toHaveCount(2);
      const edge = page.locator(".flow-sdk-edge-hit");
      await expect(edge).toHaveCount(1);
      await expect
        .poll(async () =>
          edge.evaluate((path: SVGPathElement) => {
            const captions = Array.from(
              document.querySelectorAll("[data-flow-icon-caption]"),
            ).map((caption) => caption.getBoundingClientRect());
            const matrix = path.getScreenCTM()!;
            const length = path.getTotalLength();
            return Array.from({ length: 201 }, (_, index) => {
              const local = path.getPointAtLength((length * index) / 200);
              const point = new DOMPoint(local.x, local.y).matrixTransform(
                matrix,
              );
              return captions.some(
                (caption) =>
                  point.x > caption.left &&
                  point.x < caption.right &&
                  point.y > caption.top &&
                  point.y < caption.bottom,
              );
            }).some(Boolean);
          }),
        )
        .toBe(false);
      const geometry = await edge.evaluate((path: SVGPathElement) => {
        const point = (length: number) => {
          const local = path.getPointAtLength(length);
          const screen = new DOMPoint(local.x, local.y).matrixTransform(
            path.getScreenCTM()!,
          );
          return { x: screen.x, y: screen.y };
        };
        const bounds = (id: string) => {
          const node = document.querySelector(
            `.flow-sdk-node[data-node-id="${id}"]`,
          )!;
          const surface = node
            .querySelector("[data-flow-node-surface]")!
            .getBoundingClientRect();
          const caption = node
            .querySelector("[data-flow-icon-caption]")!
            .getBoundingClientRect();
          return {
            top: surface.top,
            bottom: caption.bottom,
            middle: surface.top + surface.height / 2,
          };
        };
        return {
          start: point(0),
          end: point(path.getTotalLength()),
          source: bounds("root.analysis"),
          target: bounds("root.library"),
        };
      });
      if (direction === "TB") {
        expect(geometry.start.y).toBeGreaterThanOrEqual(geometry.source.bottom);
        expect(geometry.end.y).toBeLessThanOrEqual(geometry.target.top);
      } else if (direction === "BT") {
        expect(geometry.start.y).toBeLessThanOrEqual(geometry.source.top);
        expect(geometry.end.y).toBeGreaterThanOrEqual(geometry.target.bottom);
      } else {
        expect(
          Math.abs(geometry.start.y - geometry.source.middle),
        ).toBeLessThan(0.5);
        expect(Math.abs(geometry.end.y - geometry.target.middle)).toBeLessThan(
          0.5,
        );
      }
      await page.screenshot({
        path: test.info().outputPath("caption-clearance.png"),
      });
    });
  }
}

test("all icon labels closes an expanded grouped Tools registry", async ({
  page,
}) => {
  await ready(page, "graph=basic-json");
  await page.evaluate(() => {
    window.__flowTest.configure({
      selectionToolbar: false,
      formSchema: {
        Registry: {
          kind: "object",
          properties: {
            tools: {
              optional: false,
              type: {
                kind: "object",
                properties: {},
                additionalProperties: {
                  kind: "object",
                  properties: {
                    name: { type: { kind: "string" }, optional: false },
                  },
                },
              },
            },
          },
        },
      },
    });
    window.__flowTest.replaceDocument({
      $hideRoot: true,
      tools: {
        $label: "Tools",
        $view: "icon-label",
        $icon: "PiWrench",
        $connections: [
          {
            target: "root.consumer",
            sourceProperty: "output:lookup",
            targetProperty: "tools",
          },
          {
            target: "root.consumer",
            sourceProperty: "output:search",
            targetProperty: "tools",
          },
        ],
      },
      consumer: { $label: "Consumer", $view: "object", tools: "Configured" },
    });
    window.__flowTest.replaceForms({
      structured: true,
      state: {
        tools: {
          lookup: { name: "Lookup resource" },
          search: { name: "Search resource" },
        },
      },
      bindings: {
        "root.tools": {
          address: "root",
          type: "Registry",
          portResources: {
            "output:lookup": "root.tools.lookup",
            "output:search": "root.tools.search",
          },
        },
      },
    });
  });
  const tools = page.locator('.flow-sdk-node[data-node-id="root.tools"]');
  await expect(tools.getByText("Tools", { exact: true })).toBeVisible();
  await tools.getByText("Tools", { exact: true }).click();
  await tools
    .getByRole("button", { name: "Show properties", exact: true })
    .click();
  await expect(
    tools.getByText("Lookup resource", { exact: true }),
  ).toBeVisible();
  const toolbar = page.getByRole("toolbar", {
    name: "Diagram controls",
    exact: true,
  });
  await toolbar
    .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
    .click();
  const toggle = toolbar.getByRole("button", {
    name: "Collapse all",
    exact: true,
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(tools.getByText("Lookup resource", { exact: true })).toHaveCount(
    0,
  );
  await expect(tools.getByText("Search resource", { exact: true })).toHaveCount(
    0,
  );
  await expect(tools.getByText("Tools", { exact: true })).toBeVisible();
  await expect(page.locator(".flow-sdk-node")).toHaveCount(2);
  await expect(page.locator('[data-node-id^="root.__form_"]')).toHaveCount(0);
  await tools.getByText("Tools", { exact: true }).click();
  await tools
    .getByRole("button", { name: "Show properties", exact: true })
    .click();
  await expect(
    tools.getByText("Lookup resource", { exact: true }),
  ).toBeVisible();
  await expect(
    tools.getByText("Search resource", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__flowTest.document.tools.$connections.map(
        (edge) => edge.sourceProperty,
      ),
    ),
  ).toEqual(["output:lookup", "output:search"]);
});

for (const width of [1440, 390]) {
  test(`all icon labels expands icon-label defaults at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "graph=basic-json");
    const document = {
      $hideRoot: true,
      agent: {
        $label: "Agent",
        $view: "icon-label",
        $icon: "PiRobot",
        $form: { $type: "Agent" },
        status: "Ready",
        $connections: [{ target: "root.next" }],
      },
      next: {
        $label: "Next",
        $view: "icon-label",
        $form: { $type: "Agent" },
        status: "Waiting",
      },
    };
    await page.evaluate((next) => {
      window.__flowTest.configure({
        selectionToolbar: false,
        formSchema: {
          Agent: {
            kind: "object",
            properties: {
              status: { type: { kind: "string" }, optional: false },
            },
          },
        },
      });
      window.__flowTest.replaceDocument(next);
    }, document);
    const toolbar = page.getByRole("toolbar", {
      name: "Diagram controls",
      exact: true,
    });
    await toolbar
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    const toggle = toolbar.getByRole("button", {
      name: "Collapse all",
      exact: true,
    });
    const agent = page.locator('[data-node-id="root.agent"]');
    const next = page.locator('[data-node-id="root.next"]');
    for (let cycle = 0; cycle < 2; cycle++) {
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(agent.getByText("Ready", { exact: true })).toBeVisible();
      await expect(next.getByText("Waiting", { exact: true })).toBeVisible();
      await expect(agent.getByRole("textbox")).toHaveCount(0);
      await toggle.click();
      await expect(agent.locator("[data-flow-icon-label]")).toHaveCount(1);
      await expect(next.locator("[data-flow-icon-label]")).toHaveCount(1);
      await expect(agent.getByText("Ready", { exact: true })).toHaveCount(0);
    }
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      document,
    );
  });

  test(`background click restores icon-label after editing at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "graph=basic-json");
    await page.evaluate(() => {
      window.__flowTest.configure({
        selectionToolbar: false,
        formSchema: {
          Agent: {
            kind: "object",
            properties: {
              status: { type: { kind: "string" }, optional: false },
            },
          },
        },
      });
      window.__flowTest.replaceDocument({
        $hideRoot: true,
        agent: {
          $label: "Agent",
          $view: "icon-label",
          $icon: "PiRobot",
          $form: { $type: "Agent" },
          status: "Ready",
        },
      });
    });
    const node = page.locator('[data-node-id="root.agent"]');
    await node.getByText("Agent", { exact: true }).dblclick();
    const input = node.getByRole("textbox");
    await expect(input).toBeFocused();
    await input.fill("Edited agent");
    await page
      .locator(".flow-sdk-canvas")
      .click({ position: { x: 10, y: 100 } });
    await expect(input).toHaveCount(0);
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(1);
    await expect(node.getByText("Edited agent", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => {
        const document = window.__flowTest.document;
        return !Array.isArray(document) && document.agent.$label;
      }),
    ).toBe("Edited agent");
    await node.getByText("Edited agent", { exact: true }).dblclick();
    await expect(input).toBeFocused();
    await input.press("Enter");
    await node.getByText("Edited agent", { exact: true }).dblclick();
    const form = page.getByRole("dialog", {
      name: "Configure Edited agent",
      exact: true,
    });
    await expect(form).toBeVisible();
    await form
      .getByRole("button", { name: "Close node configuration", exact: true })
      .click();
    await page
      .locator(".flow-sdk-canvas")
      .click({ position: { x: 10, y: 100 } });
    await expect(node.locator("[data-flow-icon-label]")).toHaveCount(1);
  });

  test(`all icon labels compacts structured nodes and restores details at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "graph=basic-json");
    const document = {
      $hideRoot: true,
      sample: { $label: "Sample", $view: "object" },
    };
    await page.evaluate((next) => {
      window.__flowTest.replaceDocument(next);
      window.__flowTest.configure({
        formSchema: {
          Sample: {
            kind: "object",
            properties: {
              name: { type: { kind: "string" }, optional: false },
              options: {
                type: {
                  kind: "object",
                  properties: {
                    region: { type: { kind: "string" }, optional: false },
                  },
                },
                optional: false,
              },
              tags: {
                type: { kind: "array", items: { kind: "string" } },
                optional: false,
              },
            },
          },
        },
      });
      window.__flowTest.replaceForms({
        structured: true,
        state: {
          sample: {
            name: "Sample",
            options: { region: "West" },
            tags: ["urgent", "queued"],
          },
        },
        bindings: { "root.sample": { address: "root.sample", type: "Sample" } },
      });
    }, document);
    const details = page.getByText("West", { exact: true });
    await expect(details).toBeVisible();
    const nodeCount = await page.locator(".flow-sdk-node").count();
    expect(nodeCount).toBeGreaterThan(1);
    const toolbar = page.getByRole("toolbar", {
      name: "Diagram controls",
      exact: true,
    });
    await toolbar
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    const toggle = toolbar.getByRole("button", {
      name: "Collapse all",
      exact: true,
    });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeInViewport();
    const labels = await toolbar
      .getByRole("button")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")),
      );
    expect(labels[labels.indexOf("Compact layout") + 1]).toBe("Collapse all");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(details).toHaveCount(0);
    await expect(page.locator("[data-flow-inspection-row]")).toHaveCount(0);
    await expect(page.locator(".flow-sdk-node")).toHaveCount(1);
    await expect(page.locator('[data-node-id^="root.__form_"]')).toHaveCount(0);
    await toggle.screenshot({
      path: test.info().outputPath("all-icon-labels-toggle.png"),
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(details).toBeVisible();
    await expect(page.getByText("urgent", { exact: true })).toBeVisible();
    await expect(page.locator(".flow-sdk-node")).toHaveCount(nodeCount);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      document,
    );
  });
}
