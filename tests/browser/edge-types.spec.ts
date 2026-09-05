import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const direction of ["LR", "RL", "TB", "BT"] as const) {
  test(`${direction} built-in edge types switch reactively and preserve per-edge overrides`, async ({ page }) => {
    await ready(page, "?custom=1");
    await page.evaluate(direction => {
      window.__flowTest.configure({ direction });
      window.__flowTest.replaceGraph({
        nodes: ["alpha", "beta", "gamma"].map(id => ({ data: { id, type: "text", label: id } })),
        edges: [
          { data: { id: "default", source: "alpha", target: "beta", label: "Default", isEdgeAnimated: true } },
          { data: { id: "override", source: "alpha", target: "gamma", type: "straight", label: "Override" } },
          { data: { id: "loop", source: "gamma", target: "gamma", label: "Loop" } },
        ],
      });
    }, direction);
    const path = page.locator('.flow-sdk-edge[data-edge-id="default"] > path').first();
    const override = page.locator('.flow-sdk-edge[data-edge-id="override"] > path').first();
    await expect(path).toHaveAttribute("d", /Q/);
    for (const edgeType of ["bezier", "straight", "orthogonal", "rounded-orthogonal", "unknown"] as const) {
      await page.evaluate(edgeType => window.__flowTest.configure({ edgeType }), edgeType);
      await expect.poll(async () => {
        const value = await path.getAttribute("d") ?? "";
        return edgeType === "bezier" ? value.includes("C")
          : edgeType === "straight" ? (value.match(/L/g) ?? []).length === 1 && !/[CQ]/.test(value)
          : edgeType === "orthogonal" ? !/[CQ]/.test(value) && value.includes("L") : value.includes("Q");
      }).toBe(true);
      await expect(override).not.toHaveAttribute("d", /[CQ]/);
      await expect(page.locator('.flow-sdk-edge[data-edge-id="loop"] > path').first()).toHaveAttribute("d", /Q/);
      await expect(path).toHaveClass(/flow-sdk-edge-anim/);
      await expect(page.locator('.flow-sdk-labels .flow-sdk-edge-label[data-edge-id="default"]')).toHaveText("Default");
    }
  });
}

test("custom SVG factory receives edge data, updates reactively and retains selection and animation", async ({ page }, testInfo) => {
  await ready(page, "?custom=1");
  await page.evaluate(() => {
    window.__flowTest.configure({ edgeType: "wave", customEdgeTypes: {
      wave: context => {
        if (context.edge.id === "alpha-beta") window.__flowTest.events.push({ name: "geometry", value: { id: context.edge.id, sourceWidth: context.source.w, direction: context.direction } });
        const { sourcePoint: start, targetPoint: end } = context;
        return { d: `M${start.x} ${start.y} Q${(start.x + end.x) / 2} ${start.y - 150} ${end.x} ${end.y}`, label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 75, angle: 0 } };
      },
    } });
  });
  const path = page.locator('.flow-sdk-edge[data-edge-id="alpha-beta"] > path').first();
  await expect(path).toHaveAttribute("d", /^M.* Q/);
  await expect(page.locator('.flow-sdk-edge[data-edge-id="alpha-beta"] > path')).toHaveCount(2);
  const label = page.locator('.flow-sdk-edge-label[data-edge-id="alpha-beta"]');
  await label.click();
  await expect(page.getByRole("textbox", { name: "Edge label", exact: true })).toHaveValue("First");
  await page.getByRole("button", { name: "Edge style animated", exact: true }).click();
  await expect(path).toHaveClass(/flow-sdk-edge-anim/);
  const before = await path.getAttribute("d");
  await page.evaluate(() => window.__flowTest.resizeNode(500));
  await expect(path).not.toHaveAttribute("d", before!);
  await expect.poll(() => page.evaluate(() => window.__flowTest.events.filter(event => event.name === "geometry").at(-1)?.value)).toMatchObject({ id: "alpha-beta", sourceWidth: 500, direction: "LR" });
  await page.evaluate(() => window.__flowTest.configure({ customEdgeTypes: { wave: context => ({ ...context.defaultGeometry, d: `M${context.sourcePoint.x} ${context.sourcePoint.y} L${context.targetPoint.x} ${context.targetPoint.y}` }) } }));
  await expect(path).not.toHaveAttribute("d", /Q/);
  await page.evaluate(() => window.__flowTest.configure({ customEdgeTypes: { wave: () => null } }));
  await page.screenshot({ path: testInfo.outputPath("custom-edge.png") });
  await expect(page.locator('.flow-sdk-edge[data-edge-id="alpha-beta"] > path')).toHaveCount(3);
});

test("custom and built-in connectors retain property row endpoints", async ({ page }) => {
  await ready(page, "?graph=connections");
  await page.evaluate(() => window.__flowTest.configure({ edgeMode: "properties" }));
  const path = page.locator('.flow-sdk-edge[data-source-property="api"] > path').first();
  for (const edgeType of ["straight", "bezier", "orthogonal", "rounded-orthogonal"]) {
    await page.evaluate(edgeType => window.__flowTest.configure({ edgeType }), edgeType);
    await expect(path).toHaveAttribute("d", /^M/);
    await expect.poll(() => page.evaluate(() => {
      const row = document.querySelector('[data-node-id="root.alpha"] [data-flow-property="api"]')!.getBoundingClientRect();
      const path = document.querySelector<SVGPathElement>('.flow-sdk-edge[data-source-property="api"] > path')!;
      const start = path.getPointAtLength(0).matrixTransform(path.getScreenCTM()!);
      return Math.abs(start.y - (row.top + row.height / 2));
    })).toBeLessThan(1);
  }
});