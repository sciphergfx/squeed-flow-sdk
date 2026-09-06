import { expect, test, type Locator } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

async function modelSpan(nodes: Locator) {
  return nodes.evaluateAll((elements) => {
    const boxes = elements.map((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      const host = element as HTMLElement;
      return {
        x: matrix.m41,
        y: matrix.m42,
        width: host.offsetWidth,
        height: host.offsetHeight,
      };
    });
    return (
      (Math.max(...boxes.map((box) => box.x + box.width)) -
        Math.min(...boxes.map((box) => box.x))) *
      (Math.max(...boxes.map((box) => box.y + box.height)) -
        Math.min(...boxes.map((box) => box.y)))
    );
  });
}

for (const width of [1440, 390]) {
  test(`isolated dot switches re-layout nodes and redraw row/icon connections at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Control examples", exact: true }),
      "Parent",
    );
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Parent style", exact: true }),
      "Default",
    );
    await page.getByTestId("json-toggle").click();
    const editor = page.getByRole("textbox", {
      name: "JSON JSON",
      exact: true,
    });
    const document = {
      source: {
        $label: "Source",
        value: "",
        details: "details",
        $ports: [{ id: "value", role: "source", side: "right" }],
        $connections: [
          {
            id: "binding",
            target: "root.target",
            sourceProperty: "value",
            targetProperty: "result",
          },
        ],
      },
      ...Object.fromEntries(
        Array.from({ length: 8 }, (_, index) => [
          `hidden${index}`,
          {
            $label: `Unrelated ${index}`,
            text: "Long unrelated data. ".repeat(10),
          },
        ]),
      ),
      target: { $label: "Target", result: "result" },
    };
    await editor.fill(JSON.stringify(document));
    await page.getByTestId("json-toggle").click();
    const source = page.locator('.flow-sdk-node[data-node-id="root.source"]');
    const relevant = page.locator(
      '.flow-sdk-node[data-node-id="root"], .flow-sdk-node[data-node-id="root.source"], .flow-sdk-node[data-node-id="root.target"]',
    );
    await source.screenshot();
    const originalSpan = await modelSpan(relevant);
    await source
      .locator("[data-flow-node-surface]")
      .click({ modifiers: ["Shift"] });
    await expect(page.locator(".flow-sdk-node:visible")).toHaveCount(3);
    await expect
      .poll(() => modelSpan(relevant))
      .toBeLessThan(originalSpan * 0.9);
    const edge = page
      .locator(
        '.flow-sdk-edge[data-source-property="value"][data-target-property="result"] path',
      )
      .first();
    const anchorError = () =>
      edge.evaluate((path) => {
        const curve = path as SVGPathElement;
        const matrix = curve.getScreenCTM()!;
        const point = curve.getPointAtLength(0).matrixTransform(matrix);
        const port = document.querySelector(
          '.flow-sdk-node[data-node-id="root.source"] button[aria-label="Connect value"]',
        )!;
        const bounds = port.getBoundingClientRect();
        return Math.hypot(
          point.x - bounds.x - bounds.width / 2 - 18 * matrix.a,
          point.y - bounds.y - bounds.height / 2,
        );
      });
    await expect.poll(anchorError).toBeLessThan(2);
    let previousPath = await edge.getAttribute("d");
    for (const label of ["Show icon", "Show properties"]) {
      await source.getByRole("button", { name: label, exact: true }).click();
      await expect(source.locator("[data-flow-icon-label]")).toHaveCount(
        label === "Show icon" ? 1 : 0,
      );
      await expect.poll(() => edge.getAttribute("d")).not.toBe(previousPath);
      await expect.poll(anchorError).toBeLessThan(2);
      await expect
        .poll(async () => {
          const bounds = (await source.boundingBox())!;
          return Math.abs(bounds.x + bounds.width / 2 - width / 2);
        })
        .toBeLessThan(1);
      await expect(page.locator(".flow-sdk-node:visible")).toHaveCount(3);
      await source.screenshot();
      previousPath = await edge.getAttribute("d");
    }
    await page.screenshot({
      path: test.info().outputPath("isolated-properties.png"),
    });
    await page.getByTestId("json-toggle").click();
    expect(JSON.parse(await editor.inputValue())).toEqual(document);
    expect(errors).toEqual([]);
  });
}
