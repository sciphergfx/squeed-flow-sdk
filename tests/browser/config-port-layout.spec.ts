import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`configuration sides follow peers while input/output follow direction at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await page
      .getByRole("combobox", { name: "Example dataset", exact: true })
      .click();
    await page
      .getByRole("listbox", { name: "Example dataset", exact: true })
      .getByRole("option", { name: "Workflow State", exact: true })
      .click();
    const agent = page.locator('.flow-sdk-node[data-node-id="root.assistant"]');
    await expect(agent.locator('[data-property="config:tools"]')).toHaveCount(
      1,
    );
    const edgeIds = await page
      .locator(".flow-sdk-edge")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-edge-id")).sort(),
      );
    expect(edgeIds.length).toBeGreaterThan(10);
    await page
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    const draw = page.getByRole("button", {
      name: "Toggle draw mode",
      exact: true,
    });
    for (const [direction, label, input, output] of [
      ["TB", "Top to Bottom", "top", "bottom"],
      ["RL", "Right to Left", "right", "left"],
      ["BT", "Bottom to Up", "bottom", "top"],
      ["LR", "Left to Right", "left", "right"],
    ]) {
      await page
        .getByRole("button", { name: "Direction", exact: true })
        .click();
      await page.getByText(label, { exact: true }).click();
      await expect(
        agent.locator('[data-property="input:input"]'),
      ).toHaveAttribute("data-port-side", input);
      await expect(
        agent.locator('[data-property="output:output"]'),
      ).toHaveAttribute("data-port-side", output);
      await expect(
        page.locator(
          '.flow-sdk-node[data-node-id="root.directoryTool"] [data-property="output:resource"]',
        ),
      ).toHaveAttribute("data-port-side", output);
      await expect
        .poll(() =>
          page.evaluate((direction) => {
            const horizontal = direction === "LR" || direction === "RL";
            const surface = (id: string) =>
              document
                .querySelector(
                  `.flow-sdk-node[data-node-id="root.${id}"] [data-flow-node-surface]`,
                )!
                .getBoundingClientRect();
            const center = (bounds: DOMRect) =>
              horizontal
                ? bounds.y + bounds.height / 2
                : bounds.x + bounds.width / 2;
            const owner = surface("assistant");
            const fieldPeers: Record<string, string[]> = {
              tools: ["directoryTool", "issueTool"],
              model: ["model"],
              memory: ["knowledgeMemory"],
              promptId: ["prompt"],
              instructionIds: ["instructions"],
            };
            for (const [field, peers] of Object.entries(fieldPeers)) {
              const offset = peers.reduce(
                (total, id) => total + center(surface(id)) - center(owner),
                0,
              );
              const port = document.querySelector(
                `.flow-sdk-node[data-node-id="root.assistant"] [data-property="config:${field}"]`,
              )!;
              const side = port.getAttribute("data-port-side");
              if (
                Math.abs(offset) > 1 &&
                side !==
                  (horizontal
                    ? offset < 0
                      ? "top"
                      : "bottom"
                    : offset < 0
                      ? "left"
                      : "right")
              )
                return false;
              const bounds = port.getBoundingClientRect();
              const expected =
                side === "top"
                  ? owner.top
                  : side === "bottom"
                    ? owner.bottom
                    : side === "left"
                      ? owner.left
                      : owner.right;
              const actual = horizontal
                ? bounds.y + bounds.height / 2
                : bounds.x + bounds.width / 2;
              if (Math.abs(expected - actual) > 1) return false;
            }
            return true;
          }, direction),
        )
        .toBe(true);
      await expect(agent.locator('[data-property="config:tools"]')).toHaveCount(
        1,
      );
      await expect(
        page.locator('.flow-sdk-edge[data-target-property="config:tools"]'),
      ).toHaveCount(2);
      await page
        .getByRole("button", { name: "Reset zoom", exact: true })
        .click();
    }
    expect(
      await page
        .locator(".flow-sdk-edge")
        .evaluateAll((elements) =>
          elements
            .map((element) => element.getAttribute("data-edge-id"))
            .sort(),
        ),
    ).toEqual(edgeIds);
    const spare = page.locator(
      '.flow-sdk-node[data-node-id="root.supportMemory"] .flow-sdk-property-port',
    );
    await expect(spare).toHaveCount(0);
    await draw.click();
    await expect(spare).toHaveCount(1);
    await expect(agent.locator(".flow-sdk-property-port")).toHaveCount(7);
    await draw.click();
    await expect(spare).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("dynamic-config-ports.png"),
    });
  });
}
