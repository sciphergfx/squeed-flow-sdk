import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`Properties hides only an unconnected root and preserves its document at ${width}px`, async ({
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
      $label: "Root",
      value: "root value",
      alpha: { $label: "Alpha", value: "child value" },
      beta: { $label: "Beta", value: "unconnected" },
    };
    await editor.fill(JSON.stringify(document, null, 2));
    await page.getByTestId("json-toggle").click();
    const root = page.locator('.flow-sdk-node[data-node-id="root"]');
    const children = page.locator(
      '.flow-sdk-node[data-node-id="root.alpha"], .flow-sdk-node[data-node-id="root.beta"]',
    );
    await expect(root).toBeVisible();
    const alpha = children.first();
    const modelX = () =>
      alpha.evaluate(
        (element) =>
          new DOMMatrixReadOnly(getComputedStyle(element).transform).m41 +
          (element as HTMLElement).offsetWidth / 2,
      );
    await root.screenshot();
    const originalX = await modelX();
    await page
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    const mode = page.getByRole("combobox", { name: "Edge mode", exact: true });
    await chooseToolbarOption(mode, "Properties");
    await expect(root).toBeHidden();
    for (const child of await children.all()) await expect(child).toBeVisible();
    await expect(page.locator(".flow-sdk-edge")).toHaveCount(0);
    await expect.poll(modelX).toBeLessThan(originalX - 50);
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Control examples", exact: true }),
      "Layout",
    );
    const compact = page.getByRole("region", { name: "SDK control examples", exact: true }).getByRole("button", {
      name: "Compact property layout",
      exact: true,
    });
    await expect(compact).toHaveAttribute("aria-pressed", "true");
    const alignment = page.getByRole("combobox", {
      name: "Node alignment",
      exact: true,
    });
    const lines = page.getByRole("combobox", {
      name: "Edge type",
      exact: true,
    });
    const alignmentBox = (await alignment.boundingBox())!,
      linesBox = (await lines.boundingBox())!,
      pillBox = (await compact.boundingBox())!;
    expect(
      Math.abs(
        alignmentBox.x + alignmentBox.width - linesBox.x - linesBox.width,
      ),
    ).toBeLessThan(1);
    expect(
      Math.abs(pillBox.x + pillBox.width - linesBox.x - linesBox.width),
    ).toBeLessThan(1);
    await compact.click();
    await expect(compact).toHaveAttribute("aria-pressed", "false");
    await expect.poll(modelX).toBeCloseTo(originalX, 1);
    await expect(root).toBeHidden();
    await compact.click();
    await expect(compact).toHaveAttribute("aria-pressed", "true");
    await expect.poll(modelX).toBeLessThan(originalX - 50);
    await page
      .getByRole("region", { name: "SDK control examples", exact: true })
      .screenshot({ path: test.info().outputPath("layout-pills.png") });
    for (const option of ["Nodes", "Auto"]) {
      await chooseToolbarOption(mode, option);
      await expect(root).toBeVisible();
      await expect.poll(modelX).toBeCloseTo(originalX, 1);
    }
    await page.getByTestId("json-toggle").click();
    expect(JSON.parse(await editor.inputValue())).toEqual(document);
    const connected = {
      ...document,
      $connections: [
        {
          id: "root-port",
          target: "root.alpha",
          sourceProperty: "value",
          targetProperty: "value",
        },
      ],
    };
    await editor.fill(JSON.stringify(connected, null, 2));
    await page.getByTestId("json-toggle").click();
    await chooseToolbarOption(mode, "Properties");
    await expect(root).toBeVisible();
    await expect(
      page.locator(
        '.flow-sdk-edge[data-source-property="value"][data-target-property="value"]',
      ),
    ).toHaveCount(1);
    await page.getByTestId("json-toggle").click();
    expect(JSON.parse(await editor.inputValue())).toEqual(connected);
    expect(errors).toEqual([]);
  });
}
