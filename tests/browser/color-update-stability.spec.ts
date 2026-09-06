import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`node color edits keep the live diagram mounted and stationary at ${width}px`, async ({
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
    await pick("Example dataset", "Workflow State 2");
    await expect(
      page.locator('.flow-sdk-node[data-node-id="root.template_execution"]'),
    ).toHaveCount(1);
    let previous = "",
      stableSince = Date.now();
    await expect
      .poll(async () => {
        const next = await page
          .locator(".flow-sdk-nodes")
          .getAttribute("style");
        if (next !== previous) {
          previous = next ?? "";
          stableSince = Date.now();
        }
        return Date.now() - stableSince;
      })
      .toBeGreaterThan(800);
    const node = page.locator(
      '.flow-sdk-node[data-node-id="root.step_normalize_status"]',
    );
    await pick("Workflow step", "Normalize Status");
    await pick("Control examples", "Controls");
    await node
      .getByRole("button", { name: "Show properties", exact: true })
      .click();
    await node
      .locator('[data-flow-node-surface] [data-flow-property="value"]')
      .waitFor();
    await pick("Control examples", "Forms");
    await pick("Workflow step", "Normalize Status");
    await pick("Control examples", "Controls");
    await node.locator("[data-flow-node-surface]").click();
    const button = page.getByRole("button", {
      name: "Background pink.500",
      exact: true,
    });
    await button.scrollIntoViewIfNeeded();
    previous = "";
    stableSince = Date.now();
    await expect
      .poll(async () => {
        const next = JSON.stringify(
          await page
            .locator(".flow-sdk-node, .flow-sdk-nodes")
            .evaluateAll((elements) =>
              elements.map((element) => element.getAttribute("style")),
            ),
        );
        if (next !== previous) {
          previous = next;
          stableSince = Date.now();
        }
        return Date.now() - stableSince;
      })
      .toBeGreaterThan(800);
    const probe = await page.evaluateHandle(() => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(".flow-sdk-node"),
      );
      const layer = document.querySelector<HTMLElement>(".flow-sdk-nodes")!;
      const state = {
        nodes,
        layer,
        viewport: layer.style.transform,
        positions: nodes.map((node) => node.style.transform),
        loader: false,
        moved: false,
        started: Date.now(),
        observer: new MutationObserver(() => {}),
      };
      state.observer = new MutationObserver((records) => {
        state.loader ||= records.some((record) =>
          Array.from(record.addedNodes).some(
            (node) =>
              node instanceof Element &&
              (node.matches("[data-flow-loader]") ||
                !!node.querySelector("[data-flow-loader]")),
          ),
        );
        state.moved ||=
          layer.style.transform !== state.viewport ||
          nodes.some(
            (node, index) => node.style.transform !== state.positions[index],
          );
      });
      state.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
      return state;
    });
    const surface = node.locator("[data-flow-node-surface]");
    const color = await surface.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await button.click();
    await expect
      .poll(() =>
        surface.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .not.toBe(color);
    await expect
      .poll(() => probe.evaluate((state) => Date.now() - state.started))
      .toBeGreaterThan(1000);
    expect(
      await probe.evaluate((state) => {
        state.observer.disconnect();
        return {
          loader: state.loader,
          moved: state.moved,
          sameNodes: state.nodes.every((node) => node.isConnected),
          sameViewport: state.layer.style.transform === state.viewport,
        };
      }),
    ).toEqual({
      loader: false,
      moved: false,
      sameNodes: true,
      sameViewport: true,
    });
    await expect(
      node.getByRole("button", { name: "Show icon", exact: true }),
    ).toHaveCount(1);
    await expect(
      node.locator('[data-flow-node-surface] [data-flow-property="value"]'),
    ).toContainText("steps.agent_act.result.status");
    await probe.dispose();
    expect(errors).toEqual([]);
  });
}
