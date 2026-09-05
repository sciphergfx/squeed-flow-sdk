import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`parent variant updates preserve the live view at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator(".flow-sdk-node").first()).toBeVisible();
    const pick = async (name: string, option: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page
        .getByRole("listbox", { name, exact: true })
        .getByRole("option", { name: option, exact: true })
        .click();
    };
    await pick("Control examples", "Parent");
    await pick("Parent style", "Default");
    const container = page.locator(
      '.flow-sdk-container[data-node-id="root.cluster"]',
    );
    await container.screenshot();
    for (const option of [
      "Purple Dashed",
      "Dotted Outline",
      "Cluster Override",
      "Default",
    ]) {
      const observation = await page.evaluateHandle(() => {
        const state = {
          loaderSeen: false,
          node: document.querySelector(
            '.flow-sdk-node[data-node-id="root.cluster.intake"]',
          ),
          transform: (document.querySelector(".flow-sdk-nodes") as HTMLElement)
            .style.transform,
          observer: new MutationObserver(() => {}),
        };
        state.observer = new MutationObserver((records) => {
          state.loaderSeen ||= records.some((record) =>
            [...record.addedNodes].some(
              (node) =>
                node instanceof Element &&
                (node.matches("[data-flow-loader]") ||
                  node.querySelector("[data-flow-loader]")),
            ),
          );
        });
        state.observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
        return state;
      });
      await pick("Parent style", option);
      await expect(
        page.getByRole("combobox", { name: "Parent style", exact: true }),
      ).toContainText(option);
      await container.screenshot();
      const result = await observation.evaluate((state) => {
        state.observer.disconnect();
        return {
          loaderSeen: state.loaderSeen,
          sameNode:
            state.node ===
            document.querySelector(
              '.flow-sdk-node[data-node-id="root.cluster.intake"]',
            ),
          sameViewport:
            state.transform ===
            (document.querySelector(".flow-sdk-nodes") as HTMLElement).style
              .transform,
        };
      });
      await observation.dispose();
      expect(result).toEqual({
        loaderSeen: false,
        sameNode: true,
        sameViewport: true,
      });
    }
  });

  test(`parent styles replace the viewed JSON at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator(".flow-sdk-node").first()).toBeVisible();
    const pick = async (name: string, option: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page
        .getByRole("listbox", { name, exact: true })
        .getByRole("option", { name: option, exact: true })
        .click();
    };
    await pick("Control examples", "Layout");
    await expect(
      page.getByRole("combobox", { name: "Parent style" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("cluster-override")).toHaveCount(0);

    for (const [option, label] of [
      ["Default", "Default"],
      ["Purple Dashed", "Purple dashed"],
      ["Dotted Outline", "Dotted outline"],
      ["Cluster Override", "Cluster override"],
    ]) {
      await pick("Control examples", "Parent");
      await pick("Parent style", option);
      await expect(
        page.getByRole("combobox", { name: "Example dataset", exact: true }),
      ).toContainText("Parents");
      await expect(
        page.locator('.flow-sdk-node[data-node-id="root.cluster.intake"]'),
      ).toBeVisible();
      await expect(
        page.locator('.flow-sdk-node[data-node-id="root.cluster.process"]'),
      ).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: "Parent style", exact: true }),
      ).toContainText(option);
      await page.getByTestId("json-toggle").click();
      const inspector = page.getByTestId("squeed-json");
      await expect(inspector).toContainText(`Parent: ${label}`);
      const document = JSON.parse((await inspector.textContent())!);
      expect(document.cluster.intake.$parent).toBe("root.cluster");
      if (option === "Cluster Override")
        expect(document.cluster.$borderWidth).toBe(12);
      await page.getByTestId("json-toggle").click();
    }

    await pick("Example dataset", "Workflow State");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.assistant"]'),
    ).toBeVisible();
    await pick("Control examples", "Parent");
    await pick("Parent style", "Dotted Outline");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.cluster.intake"]'),
    ).toBeVisible();
    await pick("Example dataset", "Workflow State");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.assistant"]'),
    ).toBeVisible();
    await pick("Example dataset", "Advanced");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.gateway"]'),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await pick("Control examples", "Parent");
    await pick("Parent style", "Cluster Override");
    await expect(
      page.getByRole("status", { name: "Loading diagram" }),
    ).toHaveCount(0);
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.cluster.intake"]'),
    ).toBeInViewport();
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.cluster.process"]'),
    ).toBeInViewport();
    await expect
      .poll(
        async () =>
          (
            await page
              .locator('.flow-sdk-node[data-node-id="root.cluster.intake"]')
              .boundingBox()
          )?.width ?? 0,
      )
      .toBeGreaterThan(width === 1440 ? 100 : 20);
    await page
      .locator('.flow-sdk-container[data-node-id="root.cluster"]')
      .screenshot({
        path: test.info().outputPath("parent-container.png"),
        animations: "disabled",
      });
    await page.screenshot({
      path: test.info().outputPath("parent-popover.png"),
      animations: "disabled",
    });
  });
}
