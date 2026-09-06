import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

async function download(page: Page, label: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).click();
  return JSON.parse(readFileSync((await (await pending).path())!, "utf8"));
}

for (const width of [1440, 390]) {
  test(`all declarative presets load and preserve pure workflow exports at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const workflow = JSON.parse(
      readFileSync("examples/workflow-state-2/workflow.json", "utf8"),
    );
    const { presets } = JSON.parse(
      readFileSync("examples/workflow-state-2/designs.json", "utf8"),
    );
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Example dataset", exact: true }),
      "Workflow State 2",
    );
    for (const preset of presets) {
      await chooseToolbarOption(
        page.getByRole("combobox", { name: "Graph design", exact: true }),
        preset.label,
      );
      await expect(
        page.locator('.flow-sdk-node[data-node-id^="root.step_"]'),
      ).toHaveCount(16);
      await expect(
        page.locator('.flow-sdk-edge[data-target-property="config:tools"]'),
      ).toHaveCount(23);
      expect(await download(page, "Export resolved workflow")).toEqual(
        workflow,
      );
      const controls = page.getByRole("group", {
        name: "Diagram configuration",
        exact: true,
      });
      await controls.getByRole("tab", { name: "Files", exact: true }).click();
      const saved = await download(page, "Export diagram package");
      expect(saved.source).toEqual({ workflow });
      expect(saved.design.mapping).toEqual(preset.design.mapping);
      expect(saved.bindings.collection.idField).toBe("id");
    }
    expect(errors).toEqual([]);
  });

  test(`toolbar configuration round-trips arbitrary source and dependency edits at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/sdk-test/SDKExamplesPanel.tsx*", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const anchor = "const context = S.useFlowDiagramContext();";
      expect(body).toContain(anchor);
      await route.fulfill({
        response,
        body: body.replace(
          anchor,
          `${anchor} window.__configurationCallbacks = context.callbacks;`,
        ),
      });
    });
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Example dataset", exact: true }),
      "Workflow State 2",
    );
    const controls = page.getByRole("group", {
      name: "Diagram configuration",
      exact: true,
    });
    await expect(controls).toBeVisible();
    await controls.getByRole("tab", { name: "Files", exact: true }).click();
    const original = await download(page, "Export diagram package");
    expect(original.source.workflow.steps).toHaveLength(16);
    const schema = {
      Task: {
        kind: "object",
        properties: { value: { type: { kind: "number" }, optional: false } },
        ports: { request: { kind: "input" }, result: { kind: "output" } },
      },
    };
    const source = {
      title: "Independent jobs",
      jobs: [
        {
          key: "first",
          kind: "task",
          title: "First job",
          settings: { value: 1 },
        },
        {
          key: "second",
          kind: "task",
          title: "Second job",
          requires: ["first"],
          settings: { value: 2 },
        },
      ],
    };
    const config = {
      version: 1,
      source,
      schema,
      bindings: {
        version: 1,
        title: "root.title",
        exportAddress: "root",
        nodes: {},
        collection: {
          address: "root.jobs",
          idField: "key",
          typeField: "kind",
          propertiesField: "settings",
          labelField: "title",
          subtitleFields: ["kind"],
          nodePrefix: "job_",
          types: { task: "Task" },
        },
        dependencies: {
          field: "requires",
          sourceProperty: "output:result",
          targetProperty: "input:request",
        },
      },
      design: {
        version: 1,
        defaults: { $view: "icon-label" },
        types: { task: { $icon: "PiGear", $bgColor: "green.600" } },
        nodes: {},
        mapping: { version: 1, fields: [] },
      },
    };
    const upload = async (value: unknown) => {
      await controls
        .getByLabel("Diagram package file", { exact: true })
        .setInputFiles({
          name: "diagram.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(value)),
        });
      await controls
        .getByRole("button", {
          name: "Apply diagram configuration",
          exact: true,
        })
        .click();
      await expect(controls.getByRole("alert")).toHaveCount(0);
    };
    await upload(config);
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.job_first"]'),
    ).toContainText("First job");
    expect(await download(page, "Export resolved workflow")).toEqual(source);
    const dependency = page.locator(
      '.flow-sdk-edge[data-source-property="output:result"][data-target-property="input:request"]',
    );
    await expect(dependency).toHaveCount(1);
    await page
      .getByRole("region", { name: "SDK control examples", exact: true })
      .getByRole("button", { name: "Close selection tools", exact: true })
      .click();
    const midpoint = await dependency.locator(".flow-sdk-edge-hit").evaluate(element => {
      const path = element as SVGPathElement;
      const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
      return { x: point.x, y: point.y };
    });
    await page.mouse.click(midpoint.x, midpoint.y);
    await page
      .getByRole("button", { name: "Delete edge", exact: true })
      .click();
    await expect(dependency).toHaveCount(0);
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Control examples", exact: true }),
      "Forms",
    );
    const detached = await download(page, "Export resolved workflow");
    expect(detached.jobs[1].requires).toEqual([]);
    await page
      .getByRole("region", { name: "SDK control examples", exact: true })
      .getByRole("button", { name: "Close selection tools", exact: true })
      .click();
    const draw = page.getByRole("button", {
      name: "Toggle draw mode",
      exact: true,
    });
    if (!(await draw.isVisible()))
      await page
        .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
        .click();
    await draw.click();
    await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
    const output = page
      .locator('.flow-sdk-node[data-node-id="root.job_first"]')
      .getByRole("button", { name: "Connect output:result", exact: true });
    const input = page
      .locator('.flow-sdk-node[data-node-id="root.job_second"]')
      .getByRole("button", { name: "Input input:request", exact: true });
    await output.hover();
    await output.screenshot();
    const from = (await output.boundingBox())!,
      to = (await input.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    await expect(dependency).toHaveCount(1);
    await draw.click();
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Control examples", exact: true }),
      "Forms",
    );
    expect(await download(page, "Export resolved workflow")).toEqual(source);
    await controls.getByRole("tab", { name: "Bindings", exact: true }).click();
    await chooseToolbarOption(
      controls.getByRole("combobox", { name: "Label field", exact: true }),
      "Key",
    );
    await controls
      .getByRole("button", { name: "Apply diagram configuration", exact: true })
      .click();
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.job_first"]'),
    ).toContainText("first");
    await controls.getByRole("tab", { name: "Design", exact: true }).click();
    await chooseToolbarOption(
      controls.getByRole("combobox", { name: "Default view", exact: true }),
      "Object",
    );
    await controls
      .getByRole("button", { name: "Apply diagram configuration", exact: true })
      .click();
    await expect(
      page.locator(
        '.flow-sdk-node[data-node-id="root.job_first"] [data-flow-icon-label]',
      ),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "View state", exact: true }).click();
    const stateEditor = page.getByRole("textbox", {
      name: "State JSON",
      exact: true,
    });
    const state = JSON.parse(await stateEditor.inputValue());
    state.jobs[1].requires = [];
    state.jobs.push({
      key: "third",
      kind: "task",
      title: "Third job",
      settings: { value: 3 },
      requires: ["second"],
    });
    await stateEditor.fill(JSON.stringify(state));
    await page.getByRole("button", { name: "View state", exact: true }).click();
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Control examples", exact: true }),
      "Forms",
    );
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.job_third"]'),
    ).toContainText("third");
    await expect(dependency).toHaveCount(1);
    const edgeId = await dependency.getAttribute("data-edge-id");
    await page.evaluate((id) => {
      const callbacks = (window as any).__configurationCallbacks;
      callbacks.onEdgeDelete(id, {});
      callbacks.onEdgeCreate("root.job_first", "root.job_second", {
        sourceProperty: "output:result",
        targetProperty: "input:request",
      });
      callbacks.onEdgeCreate("root.job_first", "root.job_third", {
        sourceProperty: "output:result",
        targetProperty: "input:request",
      });
    }, edgeId);
    await expect(dependency).toHaveCount(2);
    state.jobs[1].requires = ["first"];
    state.jobs[2].requires = ["first"];
    await controls.getByRole("tab", { name: "Files", exact: true }).click();
    const saved = await download(page, "Export diagram package");
    expect(saved.bindings.collection.labelField).toBe("key");
    expect(saved.source).toEqual(state);
    await controls
      .getByLabel("Properties interface file", { exact: true })
      .setInputFiles({
        name: "properties.ts",
        mimeType: "text/plain",
        buffer: Buffer.from(
          "/**\n * @port input request\n * @port output result\n */\ninterface Task { value: number; note?: string; }",
        ),
      });
    await controls
      .getByRole("button", { name: "Apply diagram configuration", exact: true })
      .click();
    expect(
      (await download(page, "Export diagram package")).schema.Task.properties
        .note.optional,
    ).toBe(true);
    await controls
      .getByRole("button", { name: "Save diagram draft", exact: true })
      .click();
    await expect(
      controls.getByRole("status", {
        name: "Diagram draft status",
        exact: true,
      }),
    ).toHaveText("Saved");
    await page.screenshot({
      path: test.info().outputPath("configured-diagram.png"),
    });
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Graph design", exact: true }),
      "Minimal",
    );
    expect(
      (await download(page, "Export resolved workflow")).steps,
    ).toHaveLength(16);
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Graph design", exact: true }),
      "Full Bindings",
    );
    await controls.getByRole("tab", { name: "Files", exact: true }).click();
    expect(await download(page, "Export resolved workflow")).toEqual(state);
    await page.reload();
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Example dataset", exact: true }),
      "Workflow State 2",
    );
    await controls.getByRole("tab", { name: "Files", exact: true }).click();
    await controls
      .getByRole("button", { name: "Restore diagram draft", exact: true })
      .click();
    expect(await download(page, "Export resolved workflow")).toEqual(state);
    await upload(saved);
    expect(await download(page, "Export resolved workflow")).toEqual(state);
    await controls
      .getByLabel("Design JSON file", { exact: true })
      .setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"version":99}'),
      });
    await expect(controls.getByRole("alert")).toContainText("version 1");
    expect(await download(page, "Export resolved workflow")).toEqual(state);
    expect(errors).toEqual([]);
  });
}
