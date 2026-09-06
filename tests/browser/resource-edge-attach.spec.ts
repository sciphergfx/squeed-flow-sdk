import { expect, test, type Locator } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`one Tools port accepts multiple tools and supports deletion at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const pick = async (name: string, value: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page.getByRole("listbox", { name, exact: true }).getByRole("option", { name: value, exact: true }).click();
    };
    await pick("Example dataset", "Workflow State");
    await expect(page.locator('.flow-sdk-node[data-node-id="root.assistant"] [aria-haspopup="dialog"]')).toHaveCount(1);
    await expect(page.locator('.flow-sdk-edge[data-target-property="config:tools"]')).toHaveCount(2);
    for (const id of ["directory-assistant", "issues-assistant"]) {
      await page.locator(`.flow-sdk-edge-label[data-edge-id*="${id}"]`).click();
      await page.getByRole("button", { name: "Delete edge", exact: true }).click();
    }
    await expect(page.locator('.flow-sdk-edge[data-target-property="config:tools"]')).toHaveCount(0);
    await expect(page.locator('.flow-sdk-node[data-node-id="root.assistant"] [data-property="config:tools"]')).toHaveCount(0);
    await pick("Control examples", "Forms");
    await pick("Edge mode", "Properties");
    await pick("Control examples", "Controls");
    await page.getByRole("button", { name: "Toggle toolbar collapse", exact: true }).click();
    const draw = page.getByRole("button", { name: "Toggle draw mode", exact: true });
    await draw.click();
    const agent = page.locator('.flow-sdk-node[data-node-id="root.assistant"]');
    const input = agent.getByRole("button", { name: "Input config:tools", exact: true });
    const toolNode = (id: string) => page.locator(`.flow-sdk-node[data-node-id="root.${id}"]`);
    const output = (id: string) => toolNode(id).getByRole("button", { name: "Connect output:resource", exact: true });
    await expect(input).toHaveCount(1);
    await expect(input).toBeVisible();
    const attach = async (fromPort: Locator, toPort: Locator) => {
      await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
      await fromPort.hover();
      await expect(fromPort).toBeInViewport();
      await expect(toPort).toBeInViewport();
      const from = (await fromPort.boundingBox())!;
      const to = (await toPort.boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
      await page.mouse.up();
    };
    const toolsEdges = page.locator('.flow-sdk-edge[data-target-property="config:tools"]');
    const expectTools = async (values: string[]) => {
      await page.getByRole("button", { name: "View state", exact: true }).click();
      const state = JSON.parse((await page.getByTestId("squeed-json").textContent())!);
      expect(state.steps[0].config.tools).toEqual(values);
      expect(state.tools.directory_lookup).toBeDefined();
      expect(state.tools.issue_lookup).toBeDefined();
      await page.getByRole("button", { name: "View state", exact: true }).click();
    };
    await attach(output("directoryTool"), input);
    await expect(toolsEdges).toHaveCount(1);
    await attach(input, output("issueTool"));
    await expect(toolsEdges).toHaveCount(2);
    await attach(output("directoryTool"), input);
    await expect(toolsEdges).toHaveCount(2);
    await expectTools(["directory_lookup", "issue_lookup"]);
    await draw.click();
    await expect(input).toHaveCount(1);
    await expect(page.locator('.flow-sdk-node[data-node-id="root.supportMemory"] .flow-sdk-property-port')).toHaveCount(0);
    const point = await toolsEdges.first().locator(".flow-sdk-edge-hit").evaluate(element => {
      const path = element as SVGPathElement;
      const transform = path.getScreenCTM()!;
      for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
        const point = path.getPointAtLength(path.getTotalLength() * fraction).matrixTransform(transform);
        if (document.elementFromPoint(point.x, point.y)?.closest(".flow-sdk-edge") === path.parentElement)
          return { x: point.x, y: point.y };
      }
      throw new Error("No visible segment available for edge selection");
    });
    await page.mouse.click(point.x, point.y);
    await page.getByRole("button", { name: "Delete edge", exact: true }).click();
    await expect(toolsEdges).toHaveCount(1);
    await expectTools(["issue_lookup"]);
    await draw.click();
    await attach(input, output("directoryTool"));
    await expect(toolsEdges).toHaveCount(2);
    await expectTools(["directory_lookup", "issue_lookup"]);
    await expect(input).toHaveCount(1);
    await draw.click();
    await toolNode("directoryTool").getByText("Directory Lookup", { exact: true }).click();
    await page.getByRole("button", { name: "Delete selected nodes", exact: true }).click();
    await expect(toolNode("directoryTool")).toHaveCount(0);
    await expect(toolsEdges).toHaveCount(1);
    await expectTools(["issue_lookup"]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: test.info().outputPath("multiple-tools.png") });
  });
}