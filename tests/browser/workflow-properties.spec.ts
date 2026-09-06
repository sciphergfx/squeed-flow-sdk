import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { ready } from "./helpers";

const graph = JSON.parse(
  readFileSync("examples/workflow-form/graph.json", "utf8"),
);
const formDocument = JSON.parse(
  readFileSync("examples/workflow-form/ui.json", "utf8"),
);

for (const width of [1440, 390]) {
  test(`full interfaces replace limited form schemas at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=json");
    const node = page.locator('.flow-sdk-node[data-node-id="root.workflow"]');
    await expect(node).toBeVisible();
    await page
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    const file = page.getByLabel("Workflow interface file", { exact: true });
    await file.setInputFiles("examples/workflow-form/supported-interface.ts");
    await expect(node.locator('[aria-haspopup="dialog"]')).toHaveCount(1);
    const original = await page.evaluate(() => window.__flowTest.document);
    await node.getByText("Workflow", { exact: true }).dblclick();
    const form = page.getByRole("dialog", {
      name: "Configure Workflow",
      exact: true,
    });
    await expect(
      form.getByRole("combobox", { name: "Trigger", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await file.setInputFiles("examples/workflow-form/full-interface.ts");
    await node.getByText("Workflow", { exact: true }).dblclick();
    await expect(
      form.getByRole("textbox", { name: "Trigger", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      original,
    );
  });

  test(`generated workflow property mappings validate at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=json");
    await page.evaluate((document) => {
      window.__flowTest.replaceDocument(document);
      window.__flowTest.configure({ edgeMode: "properties" });
    }, graph);
    await page.mouse.click(10, 10);
    const file = page.getByLabel("Workflow interface file", { exact: true });
    await file.setInputFiles("examples/workflow-form/supported-interface.ts");
    await expect(
      page.getByRole("status").filter({ hasText: "supported-interface.ts" }),
    ).toContainText("9 invalid or unverified");
    const mappings = page.locator(".flow-sdk-edge[data-source-property]");
    await expect(mappings).toHaveCount(17);
    await expect(
      page.locator('.flow-sdk-edge[data-validation="invalid"]'),
    ).toHaveCount(8);
    await expect(
      page.locator('.flow-sdk-edge[data-validation="unverified"]'),
    ).toHaveCount(1);
    await expect(
      page.locator(
        ".flow-sdk-edge[data-source-property]:not([data-validation])",
      ),
    ).toHaveCount(8);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      graph,
    );
    await file.setInputFiles("examples/workflow-form/full-interface.ts");
    await expect(page.getByRole("alert")).toContainText(
      "Unsupported TypeScript type: any",
    );
    await expect(
      page.locator('.flow-sdk-edge[data-validation="invalid"]'),
    ).toHaveCount(8);
    await page.evaluate(() =>
      window.__flowTest.configure({ edgeMode: "nodes" }),
    );
    await expect(page.locator(".flow-sdk-edge-validation")).toHaveCount(0);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      graph,
    );
  });

  test(`workflow interfaces expose editable node properties at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/?graph=json");
    await page.waitForFunction(
      () => !!window.__flowTest?.engine?.getNodeBox("root.workflow"),
    );
    const document = formDocument;
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      document,
    );
    await expect(
      page.getByRole("status").filter({ hasText: "form types loaded" }),
    ).toHaveCount(0);
    await page
      .locator('.flow-sdk-node[data-node-id="root.workflow"]')
      .getByText("Workflow", { exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Configure Workflow", exact: true }),
    ).toHaveCount(0);
    await page.mouse.click(10, 10);
    await expect(
      page.getByRole("button", { name: "Upload form schema", exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-form/supported-interface.ts");
    await expect(
      page.getByRole("status").filter({ hasText: "form types loaded" }),
    ).toBeVisible();
    const workflow = page.locator('[data-flow-form="root.workflow"]');
    const step = page.locator('[data-flow-form="root.workflow.steps.0"]');
    const workflowNode = page.locator(
      '.flow-sdk-node[data-node-id="root.workflow"]',
    );
    const stepNode = page.locator(
      '.flow-sdk-node[data-node-id="root.workflow.steps.0"]',
    );
    await expect(workflow).toHaveCount(0);
    await expect(
      workflowNode.getByRole("button", {
        name: "Configure Workflow",
        exact: true,
      }),
    ).toHaveCount(0);
    await workflowNode.getByText("Workflow", { exact: true }).dblclick();
    const popup = page.getByRole("dialog", {
      name: "Configure Workflow",
      exact: true,
    });
    await expect(popup).toBeVisible();
    for (const section of await workflow.locator("details").all()) {
      expect(
        await section.locator("[data-form-field]").count(),
      ).toBeGreaterThan(1);
      if ((await section.getAttribute("open")) === null)
        await section.locator("summary").click();
    }
    await expect(
      workflow.locator("input[placeholder], textarea[placeholder]"),
    ).toHaveCount(0);
    const trigger = workflow.getByRole("combobox", {
      name: "Trigger",
      exact: true,
    });
    await expect(trigger.locator("option:not([disabled])")).toHaveText([
      "Manual",
      "Schedule",
      "Webhook",
      "Event",
    ]);
    await trigger.selectOption({ label: "Event" });
    await expect
      .poll(() =>
        page.evaluate(() => window.__flowTest.document.workflow.trigger),
      )
      .toBe("event");
    await trigger.selectOption({ label: "Manual" });
    await expect(popup).toHaveCSS("border-radius", "30px");
    await expect(popup).toHaveCSS("scrollbar-width", "none");
    await expect(popup).toHaveCSS("overflow-y", "auto");
    await popup.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    expect(
      await popup.evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(0);
    await popup.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(
      workflow.getByRole("textbox", { name: "Steps", exact: true }),
    ).toHaveCSS("scrollbar-width", "none");
    await expect(popup).toHaveCSS("box-shadow", /8px/);
    const themeTextColors: Record<string, string> = {};
    for (const colorMode of ["light", "dark"] as const) {
      await page.evaluate(
        (colorMode) => window.__flowTest.configure({ colorMode }),
        colorMode,
      );
      const textColor = await popup.evaluate(
        (element) => getComputedStyle(element).color,
      );
      themeTextColors[colorMode] = textColor;
      for (const field of [
        workflow.getByRole("textbox", { name: "Name", exact: true }),
        workflow.getByRole("textbox", { name: "Steps", exact: true }),
      ]) {
        await expect(field).toHaveCSS("border-width", "0px");
        await expect(field).toHaveCSS("box-shadow", "none");
        await expect(field).toHaveCSS("color", textColor);
        await expect(field).not.toHaveCSS(
          "background-color",
          "rgba(0, 0, 0, 0)",
        );
      }
    }
    const bounds = await popup.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(16);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 16);
    await expect(
      workflow.getByRole("textbox", { name: "Steps", exact: true }),
    ).toBeVisible();
    await workflow
      .getByRole("textbox", { name: "On Error", exact: true })
      .fill('{"notify":true}');
    await workflow
      .getByRole("textbox", { name: "On Error", exact: true })
      .press("Tab");
    await expect
      .poll(() =>
        page.evaluate(() => window.__flowTest.document.workflow.onError),
      )
      .toEqual({ notify: true });
    await expect(
      workflow.getByRole("textbox", { name: "Name", exact: true }),
    ).toHaveValue("Order Processing");
    await workflow
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Updated workflow");
    await workflow
      .getByRole("textbox", { name: "Name", exact: true })
      .press("Enter");
    await workflow
      .getByRole("spinbutton", { name: "Timeout Ms", exact: true })
      .fill("45000");
    await workflow
      .getByRole("spinbutton", { name: "Timeout Ms", exact: true })
      .press("Enter");
    const publicOptions = workflow.getByRole("group", {
      name: "Is Public",
      exact: true,
    });
    const yes = publicOptions.getByRole("button", { name: "Yes", exact: true });
    const no = publicOptions.getByRole("button", { name: "No", exact: true });
    await expect(no).toHaveAttribute("aria-pressed", "true");
    await expect(yes).toHaveCSS("border-width", "0px");
    await yes.click();
    await expect(yes).toHaveAttribute("aria-pressed", "true");
    await no.click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__flowTest.document.workflow.isPublic),
      )
      .toBe(false);
    const reset = workflow.getByRole("button", {
      name: "Reset Is Public",
      exact: true,
    });
    await expect(reset).toHaveCSS("width", "24px");
    await expect(reset.locator("svg")).toHaveAttribute("width", "14");
    await reset.click();
    await expect(no).toHaveAttribute("aria-pressed", "false");
    await expect(yes).toHaveAttribute("aria-pressed", "false");
    await yes.focus();
    await yes.press("Space");
    await expect(yes).toHaveAttribute("aria-pressed", "true");
    await popup
      .getByRole("button", { name: "Close node configuration", exact: true })
      .click();
    await expect(workflow).toHaveCount(0);
    await stepNode.getByText("Check Order", { exact: true }).first().dblclick();
    const executionTarget = step.getByRole("combobox", {
      name: "Execution Target",
      exact: true,
    });
    await expect(executionTarget).toBeVisible();
    await expect(executionTarget).toHaveCSS("padding-right", "40px");
    const arrow = step.locator(
      '[data-form-field="root.workflow.steps.0.executionTarget"] [data-form-select] > svg',
    );
    await expect(arrow).toHaveCSS("right", "12px");
    await expect(arrow).toHaveCSS("pointer-events", "none");
    for (const section of await step.locator("details").all()) {
      expect(
        await section.locator("[data-form-field]").count(),
      ).toBeGreaterThan(1);
      if ((await section.getAttribute("open")) === null)
        await section.locator("summary").click();
    }
    await expect(
      step.locator("option").filter({ hasText: "Select..." }),
    ).toHaveCount(0);
    await step
      .getByRole("combobox", { name: "Execution Target", exact: true })
      .selectOption({ label: "Server" });
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__flowTest.document.workflow.steps[0].executionTarget,
        ),
      )
      .toBe("server");
    const saved = await page.evaluate(() => window.__flowTest.document);
    expect(saved.workflow.name).toBe("Updated workflow");
    expect(saved.workflow.timeoutMs).toBe(45000);
    expect(saved.workflow.isPublic).toBe(true);
    expect(saved.workflow.steps[0].retry).toEqual({ maxAttempts: 3 });
    expect(saved.workflow.$form).toEqual(document.workflow.$form);
    await page
      .getByRole("button", { name: "Close node configuration", exact: true })
      .click();
    await workflowNode.getByText("Workflow", { exact: true }).dblclick();
    await workflow.getByRole("textbox", { name: "Name", exact: true }).fill("");
    await workflow
      .getByRole("textbox", { name: "Name", exact: true })
      .press("Enter");
    await expect(
      workflow.getByRole("textbox", { name: "Name", exact: true }),
    ).toHaveAttribute("aria-invalid", "true");
    for (const section of await workflow.locator("details").all()) {
      if ((await section.getAttribute("open")) === null)
        await section.locator("summary").click();
    }
    await page.screenshot({ path: testInfo.outputPath("workflow-forms.png") });
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(
      workflow.getByRole("textbox", { name: "Name", exact: true }),
    ).toBeDisabled();
    await expect(yes).toBeDisabled();
    await expect(no).toBeDisabled();
    await page
      .getByRole("button", { name: "Close node configuration", exact: true })
      .click();
    await expect(popup).not.toBeVisible();
    await page.evaluate(() => window.__flowTest.configure({ readOnly: false }));
    await page.mouse.click(10, 10);
    for (const colorMode of ["light", "dark"] as const) {
      await page.evaluate(
        (colorMode) => window.__flowTest.configure({ colorMode }),
        colorMode,
      );
      await expect(
        page.getByRole("status").filter({ hasText: "form types loaded" }),
      ).toHaveCSS("color", themeTextColors[colorMode]);
    }
    await page
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-form/full-interface.ts");
    await expect(
      page.getByRole("status").filter({ hasText: "full-interface.ts" }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(workflowNode.locator('[aria-haspopup="dialog"]')).toHaveCount(
      1,
    );
    await page
      .getByRole("button", { name: "Remove workflow interface", exact: true })
      .click();
    await expect(workflowNode.locator('[aria-haspopup="dialog"]')).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("status").filter({ hasText: "form types loaded" }),
    ).toHaveCount(0);
  });
}
