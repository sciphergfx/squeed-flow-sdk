import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390])
  test(`compact property graph reduces mixed-node gaps at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/sdk-test/SDKExamplesPanel.tsx*", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const anchor = "const colors = S.useCustomColors();";
      expect(body).toContain(anchor);
      await route.fulfill({
        response,
        body: body.replace(
          anchor,
          `${anchor} window.__compactTest = { context, nodeById, edgeById };`,
        ),
      });
    });
    await page.goto(process.env.SDK_TEST_URL!);
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Example dataset", exact: true }),
      "Workflow State 3",
    );
    await expect(
      page.locator('[data-node-id="root.step_agent_act"]'),
    ).toHaveCount(1);
    await page.evaluate(() => {
      const { context } = (window as any).__compactTest;
      context.callbacks.onCompactPropertyLayoutChange(false);
      for (const id of [
        "root.step_agent_act",
        "root.step_mark_running",
        "root.step_notify",
      ])
        context.setNodeViewMode(id, "properties");
    });
    const settled = async () => {
      let previous = "",
        stable = 0;
      await expect
        .poll(async () => {
          const geometry = await page.evaluate(() => {
            const { context, nodeById } = (window as any).__compactTest;
            return JSON.stringify(
              [...nodeById.keys()].map((id) =>
                context.engineRef.current?.getNodeBox(id),
              ),
            );
          });
          stable = geometry === previous ? stable + 1 : 0;
          previous = geometry;
          return stable;
        })
        .toBeGreaterThanOrEqual(3);
      return page.evaluate(() => {
        const { context, nodeById, edgeById } = (window as any).__compactTest;
        const parents = new Set(
          [...nodeById.values()].map((node: any) => node.data.parent),
        );
        const boxes = [...nodeById.keys()]
          .filter((id) => id !== "root" && !parents.has(id))
          .flatMap((id) => {
            const box = context.engineRef.current.getNodeBox(id);
            return box ? [{ id, ...box }] : [];
          });
        const width =
          Math.max(...boxes.map((box) => box.x + box.w / 2)) -
          Math.min(...boxes.map((box) => box.x - box.w / 2));
        const height =
          Math.max(...boxes.map((box) => box.y + box.h / 2)) -
          Math.min(...boxes.map((box) => box.y - box.h / 2));
        return {
          boxes,
          area: width * height,
          nodes: nodeById.size,
          edges: edgeById.size,
        };
      });
    };
    const regular = await settled();
    await page.evaluate(() =>
      (
        window as any
      ).__compactTest.context.callbacks.onCompactPropertyLayoutChange(true),
    );
    const compact = await settled();
    expect(compact.area).toBeLessThan(regular.area * 0.85);
    expect(compact.nodes).toBe(regular.nodes);
    expect(compact.edges).toBe(regular.edges);
    for (const first of compact.boxes)
      for (const second of compact.boxes) {
        if (first.id === second.id) continue;
        const separated =
          Math.abs(first.x - second.x) >= (first.w + second.w) / 2 - 1 ||
          Math.abs(first.y - second.y) >= (first.h + second.h) / 2 - 1;
        expect(separated, `${first.id} overlaps ${second.id}`).toBe(true);
      }
    await page
      .getByRole("region", { name: "SDK control examples" })
      .getByRole("button", { name: "Close selection tools", exact: true })
      .click();
    await page.evaluate(() =>
      (window as any).__compactTest.context.engineRef.current.centerAndFit(
        60,
        false,
      ),
    );
    await page.screenshot({ path: `/tmp/squeed-compact-density-${width}.png` });
  });
