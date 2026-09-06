import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

function withoutGeneratedPorts(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (key, entry) =>
      key === "$ports" ? undefined : entry,
    ),
  );
}

for (const width of [1440, 390]) {
  test(`reusable configuration parent restores its mixed child views and links at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await page
      .getByRole("combobox", { name: "Example dataset", exact: true })
      .click();
    await page
      .getByRole("listbox", { name: "Example dataset", exact: true })
      .getByRole("option", { name: "Workflow State 2", exact: true })
      .click();
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.template_execution"]'),
    ).toHaveCount(1);
    const container = page.locator(
      '.flow-sdk-container[data-node-id="root.sdkResources"]',
    );
    const label = page.locator(
      '.flow-sdk-container-label[data-node-id="root.sdkResources"]',
    );
    const compact = page.locator(
      '.flow-sdk-node[data-node-id="root.sdkResources"]',
    );
    const children = page.locator(
      '.flow-sdk-node[data-node-id^="root.resource_"]',
    );
    await expect(children).toHaveCount(5);
    await container.screenshot();
    const edges = await page
      .locator(".flow-sdk-edge")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-edge-id")).sort(),
      );
    await page.getByTestId("json-toggle").click();
    const editor = page.getByRole("textbox", {
      name: "JSON JSON",
      exact: true,
    });
    const original = JSON.parse(await editor.inputValue());
    await page.getByTestId("json-toggle").click();
    await expect(
      label.getByRole("button", { name: "Show icon", exact: true }),
    ).toHaveCount(0);
    await label.locator("text").click();
    await label.getByRole("button", { name: "Show icon", exact: true }).click();
    await expect(container).toHaveCount(0);
    await expect(children).toHaveCount(0);
    await expect(compact.locator("[data-flow-icon-label]")).toHaveCount(1);
    await expect(compact.locator("[data-flow-inspection-row]")).toHaveCount(0);
    await page.getByTestId("json-toggle").click();
    expect(
      withoutGeneratedPorts(JSON.parse(await editor.inputValue())),
    ).toEqual(
      withoutGeneratedPorts({
        ...original,
        sdkResources: { ...original.sdkResources, $collapsed: true },
      }),
    );
    await page.getByTestId("json-toggle").click();
    await page
      .getByRole("button", { name: "Close selection tools", exact: true })
      .click();
    await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
    await compact.locator("[data-flow-node-surface]").click();
    await page.screenshot({ path: test.info().outputPath("parent-icon.png") });
    await compact
      .getByRole("button", { name: "Show parent", exact: true })
      .click();
    await expect(container).toHaveCount(1);
    await expect(children).toHaveCount(5);
    await expect(compact.locator("[data-flow-inspection-row]")).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator(".flow-sdk-edge")
          .evaluateAll((elements) =>
            elements
              .map((element) => element.getAttribute("data-edge-id"))
              .sort(),
          ),
      )
      .toEqual(edges);
    await page.screenshot({
      path: test.info().outputPath("parent-restored.png"),
    });
    await page.getByTestId("json-toggle").click();
    expect(
      withoutGeneratedPorts(JSON.parse(await editor.inputValue())),
    ).toEqual(
      withoutGeneratedPorts({
        ...original,
        sdkResources: { ...original.sdkResources, $collapsed: false },
      }),
    );
    expect(errors).toEqual([]);
  });

  for (const labelled of [true, false]) {
    test(`${labelled ? "labelled" : "unlabelled"} parent switches only between icon and container at ${width}px`, async ({
      page,
    }) => {
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
      await pick("Control examples", "Parent");
      await pick("Parent style", "Default");
      await page.getByTestId("json-toggle").click();
      const editor = page.getByRole("textbox", {
        name: "JSON JSON",
        exact: true,
      });
      const original = JSON.parse(await editor.inputValue());
      if (!labelled) {
        original.cluster.$label = "";
        await editor.fill(JSON.stringify(original, null, 2));
      }
      await page.getByTestId("json-toggle").click();
      const container = page.locator(
        '.flow-sdk-container[data-node-id="root.cluster"]',
      );
      const label = page.locator(
        '.flow-sdk-container-label[data-node-id="root.cluster"]',
      );
      const compact = page.locator(
        '.flow-sdk-node[data-node-id="root.cluster"]',
      );
      const children = page.locator(
        '.flow-sdk-node[data-node-id^="root.cluster."]',
      );
      await expect(children).toHaveCount(2);
      await expect(page.locator(".flow-sdk-edge")).toHaveCount(4);
      const edges = await page
        .locator(".flow-sdk-edge")
        .evaluateAll((elements) =>
          elements
            .map((element) => element.getAttribute("data-edge-id"))
            .sort(),
        );
      await expect(
        page.getByRole("button", { name: "Show icon", exact: true }),
      ).toHaveCount(0);
      if (labelled) await label.locator("text").click();
      else {
        await expect(label.locator("text")).toHaveCount(0);
        const surface = container.locator("rect").first();
        await surface.screenshot();
        const position = await surface.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          for (let offsetY = 4; offsetY < bounds.height - 4; offsetY += 4) {
            for (let offsetX = 4; offsetX < bounds.width - 4; offsetX += 4) {
              const point = { x: bounds.x + offsetX, y: bounds.y + offsetY };
              if (
                [-2, 0, 2].every(
                  (delta) =>
                    document.elementFromPoint(
                      point.x + delta,
                      point.y + delta,
                    ) === element,
                )
              )
                return point;
            }
          }
          throw new Error("Parent has no clickable surface");
        });
        await page.mouse.click(position.x, position.y);
      }
      const collapse = page.getByRole("button", {
        name: "Show icon",
        exact: true,
      });
      await expect(collapse).toBeVisible();
      await expect(page.locator(".flow-sdk-labels")).toHaveCSS("outline-style", "none");
      await page.screenshot({
        path: test.info().outputPath("selected-parent.png"),
      });
      await collapse.click();
      await expect(container).toHaveCount(0);
      await expect(children).toHaveCount(0);
      await expect(compact.locator("[data-flow-icon-label]")).toHaveCount(1);
      await expect(compact.locator("[data-flow-inspection-row]")).toHaveCount(
        0,
      );
      await page
        .getByRole("button", { name: "Close selection tools", exact: true })
        .click();
      await expect(compact.locator("[data-flow-content-toggle]")).toHaveCount(
        0,
      );
      await page
        .getByRole("button", { name: "Reset zoom", exact: true })
        .click();
      await compact.locator("[data-flow-node-surface]").click();
      await expect(
        compact.getByRole("button", { name: "Show properties", exact: true }),
      ).toHaveCount(0);
      await compact
        .getByRole("button", { name: "Show parent", exact: true })
        .click();
      await expect(container).toHaveCount(1);
      await expect(children).toHaveCount(2);
      await expect(compact.locator("[data-flow-inspection-row]")).toHaveCount(
        0,
      );
      await expect
        .poll(() =>
          page
            .locator(".flow-sdk-edge")
            .evaluateAll((elements) =>
              elements
                .map((element) => element.getAttribute("data-edge-id"))
                .sort(),
            ),
        )
        .toEqual(edges);
      await page.getByTestId("json-toggle").click();
      expect(JSON.parse(await editor.inputValue())).toEqual(original);
      expect(errors).toEqual([]);
    });
  }
}
