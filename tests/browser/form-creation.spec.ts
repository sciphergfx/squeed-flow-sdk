import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`draw from Trigger creates a Step with a double-click form at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.evaluate(() => {
      window.__flowTest.replaceDocument({
        workflow: {
          $label: "Trigger",
          name: "Orders",
          trigger: "manual",
          steps: [],
          $form: {
            $type: "Workflow",
            $create: {
              $address: "root.workflow.steps",
              $type: "Step",
              $label: "Step",
              $edgeLabel: "Next",
              $defaults: { name: "New step", type: "conditional" },
            },
          },
        },
      });
    });
    await page.mouse.click(10, 10);
    await page
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles({
        name: "workflow.ts",
        mimeType: "text/plain",
        buffer: Buffer.from(
          'interface Workflow { name: string; trigger: "manual" | "event"; steps: Step[] } interface Step { id: string; name: string; type: "conditional" | "http" }',
        ),
      });
    await expect(
      page.getByRole("status").filter({ hasText: "2 form types loaded" }),
    ).toBeVisible();
    const drawFrom = async (address: string, count: number) => {
      await page.waitForFunction(
        (address) => !!window.__flowTest.engine?.getNodeBox(address),
        address,
      );
      await page.evaluate(() =>
        window.__flowTest.configure({
          isEdgeHandlesEnabled: true,
          edgeMode: "nodes",
        }),
      );
      const point = await page.evaluate((address) => {
        const engine = window.__flowTest.engine!;
        const box = engine.getNodeBox(address)!;
        const bounds = document
          .querySelector(".flow-sdk-canvas")!
          .getBoundingClientRect();
        engine.zoom(0.12);
        engine.pan({
          x: bounds.width / 2 - box.x * 0.12,
          y: 180 - box.y * 0.12,
        });
        return { x: bounds.x + bounds.width / 2, y: bounds.y + 180 };
      }, address);
      const node = page.locator(`.flow-sdk-node[data-node-id="${address}"]`);
      await expect(node).toBeVisible();
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(width - 40, 730, { steps: 12 });
      await page.mouse.up();
      await expect
        .poll(() =>
          page.evaluate(() => window.__flowTest.document.workflow.steps.length),
        )
        .toBe(count);
      await page.evaluate(() =>
        window.__flowTest.configure({ isEdgeHandlesEnabled: false }),
      );
    };
    await drawFrom("root.workflow", 1);
    await drawFrom("root.workflow.steps.0", 2);
    const document = await page.evaluate(() => window.__flowTest.document);
    expect(document.workflow.steps[0].$form.$type).toBe("Step");
    expect(document.workflow.steps[1].id).not.toBe(
      document.workflow.steps[0].id,
    );
    expect(document.workflow.steps[0].$connections[0].target).toBe(
      "root.workflow.steps.1",
    );
    const step = page.locator(
      '.flow-sdk-node[data-node-id="root.workflow.steps.0"]',
    );
    await step.getByText("Step", { exact: true }).dblclick();
    const dialog = page.getByRole("dialog", {
      name: "Configure Step",
      exact: true,
    });
    await dialog
      .getByRole("combobox", { name: "Type", exact: true })
      .selectOption({ label: "Http" });
    await expect
      .poll(() =>
        page.evaluate(() => window.__flowTest.document.workflow.steps[0].type),
      )
      .toBe("http");
    await page.screenshot({
      path: testInfo.outputPath("created-step-form.png"),
    });
    await dialog
      .getByRole("button", { name: "Close node configuration", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });
}
