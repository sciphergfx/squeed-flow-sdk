import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const workflow = JSON.parse(
  readFileSync("examples/workflow-state-2/workflow.json", "utf8"),
);

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`cast session forms preserve source data and variant isolation at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.route("**/sdk-test/resourceMappings.ts*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "export const SDK_RESOURCE_MAPPINGS = {};",
      }),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const pick = async (name: string, value: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page
        .getByRole("listbox", { name, exact: true })
        .getByRole("option", { name: value, exact: true })
        .click();
    };
    const readState = async () => {
      await page
        .getByRole("button", { name: "View state", exact: true })
        .click();
      const state = JSON.parse(
        (await page.getByTestId("squeed-json").textContent())!,
      );
      await page
        .getByRole("button", { name: "View state", exact: true })
        .click();
      return state;
    };
    await pick("Example dataset", "Workflow State 2");
    await expect(
      page.locator(
        '.flow-sdk-node[data-node-id="root.step_agent_act"] [aria-haspopup="dialog"]',
      ),
    ).toHaveCount(1);
    await expect(page.locator(".flow-sdk-node")).toHaveCount(19);
    await expect(page.locator(".flow-sdk-container")).toHaveCount(0);
    const toolsEdges = page.locator(
      '.flow-sdk-edge[data-target-property="config:tools"]',
    );
    await expect(toolsEdges).toHaveCount(23);
    await expect(
      page.locator('.flow-sdk-edge[data-target-property="input:input"]'),
    ).toHaveCount(16);
    await expect(
      page.locator(
        '.flow-sdk-node[data-node-id="root.step_agent_act"] [data-property="config:tools"]',
      ),
    ).toHaveCount(1);
    const edges = page.locator(".flow-sdk-edge");
    const originalIds = await edges.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-edge-id")).sort(),
    );
    const normal = page.locator(
      ".flow-sdk-edge:not([data-source-property]):not([data-target-property])",
    );
    const normalCount = await normal.count();
    await pick("Edge mode", "Nodes");
    await expect(toolsEdges).toHaveCount(0);
    await expect(edges).toHaveCount(normalCount);
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.tools"]'),
    ).toHaveCount(1);
    await pick("Edge mode", "Properties");
    await expect(normal).toHaveCount(0);
    await expect(edges).toHaveCount(39);
    await pick("Edge mode", "Auto");
    await expect(edges).toHaveCount(originalIds.length);
    expect(
      await edges.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-edge-id")).sort(),
      ),
    ).toEqual(originalIds);
    expect((await readState()).workflow).toEqual(workflow);
    await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
    await page.screenshot({
      path: test.info().outputPath("cast-session-graph.png"),
    });

    await pick("Control examples", "Forms");
    for (const [index, step] of workflow.steps.entries()) {
      await page
        .getByRole("combobox", { name: "Workflow step", exact: true })
        .click();
      await page
        .getByRole("listbox", { name: "Workflow step", exact: true })
        .getByRole("option")
        .nth(index)
        .click();
      const node = page.locator(
        `.flow-sdk-node[data-node-id="root.step_${step.id}"]`,
      );
      await node.getByText(step.name, { exact: true }).first().dblclick();
      const form = page.getByRole("dialog", {
        name: `Configure ${step.name}`,
        exact: true,
      });
      await expect(form).toBeVisible();
      for (const field of Object.keys(step.config))
        await expect(
          form.locator(
            `[data-form-field="root.workflow.steps.${index}.config.${field}"]`,
          ),
        ).toHaveCount(1);
      if (step.id === "find") {
        const collection = form.getByRole("textbox", {
          name: "Collection",
          exact: true,
        });
        await expect(collection).toHaveValue(step.config.collection);
        await collection.fill("test_sessions_variant2");
        await collection.press("Tab");
      }
      if (step.id === "agent_act") {
        await expect(
          form.getByRole("textbox", { name: "Prompt", exact: true }),
        ).toHaveValue(step.config.prompt);
        await page.screenshot({
          path: test.info().outputPath("cast-session-agent-form.png"),
        });
      }
      await page.keyboard.press("Escape");
    }
    const edited = structuredClone(workflow);
    edited.steps[0].config.collection = "test_sessions_variant2";
    const stateBeforeUpload = await readState();
    expect(stateBeforeUpload.workflow).toEqual(edited);
    expect(Object.keys(stateBeforeUpload.tools)).toHaveLength(23);

    await pick("Control examples", "Forms");
    await page
      .getByRole("region", { name: "SDK control examples" })
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-state-2/interface.ts");
    await expect(toolsEdges).toHaveCount(23);
    expect(await readState()).toEqual(stateBeforeUpload);

    await pick("Example dataset", "Workflow State");
    await expect(
      page.locator(
        '.flow-sdk-node[data-node-id="root.assistant"] [aria-haspopup="dialog"]',
      ),
    ).toHaveCount(1);
    await expect(toolsEdges).toHaveCount(2);
    const original = await readState();
    expect(original.workflow).toBeUndefined();
    expect(original.steps[0].config.tools).toEqual([
      "directory_lookup",
      "issue_lookup",
    ]);
    await pick("Example dataset", "Workflow State 2");
    await expect(toolsEdges).toHaveCount(23);
    expect(await readState()).toEqual(stateBeforeUpload);
    expect(errors).toEqual([]);
  });
}
