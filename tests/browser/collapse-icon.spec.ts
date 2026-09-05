import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const colorMode of ["light", "dark"] as const) {
  test(`collapse and expand icons use a visible SVG color in ${colorMode}`, async ({
    page,
  }) => {
    await ready(page, "?graph=json");
    await page.evaluate((colorMode) => {
      window.__flowTest.configure({ colorMode });
      window.__flowTest.replaceDocument({
        tags: {
          $: ["Region", "Production"],
          $label: "Deployment",
          $bgColor: "#e0f2fe",
        },
      });
    }, colorMode);
    const node = page.locator('.flow-sdk-node[data-node-id="root.tags"]');
    for (const action of ["Collapse", "Expand"]) {
      const button = node.getByRole("button", { name: action, exact: true });
      await node.hover();
      await expect(
        node.getByRole("button", { name: "Draw edge", exact: true }),
      ).toHaveCount(0);
      await expect(button.locator("svg")).toHaveAttribute(
        "color",
        /^#[0-9a-f]{6}$/i,
      );
      const channels = await button
        .locator("path")
        .evaluate((element) =>
          getComputedStyle(element).fill.match(/\d+/g)?.map(Number),
        );
      expect(channels).toHaveLength(3);
      expect(Math.max(...channels!)).toBeLessThan(80);
      await button.click();
      await expect(
        page.locator('.flow-sdk-node[data-node-id="root.tags.0"]'),
      ).toHaveCount(action === "Collapse" ? 0 : 1);
    }
  });
}

for (const [kind, value, childId] of [
  ["plain array", ["Region", "Production"], "root.branch.0"],
  ["nested object", { child: { value: "Region" } }, "root.branch.child"],
] as const) {
  test(`${kind} exposes collapse without explicit metadata`, async ({
    page,
  }) => {
    await ready(page, "?graph=json");
    await page.evaluate(
      (value) =>
        window.__flowTest.replaceDocument({ branch: value, leaf: "Leaf" }),
      value,
    );
    const node = page.locator('.flow-sdk-node[data-node-id="root.branch"]');
    const child = page.locator(`.flow-sdk-node[data-node-id="${childId}"]`);
    await expect(child).toBeVisible();
    await node.getByRole("button", { name: "Collapse", exact: true }).click();
    await expect(child).toHaveCount(0);
    await node.getByRole("button", { name: "Expand", exact: true }).click();
    await expect(child).toBeVisible();
    await expect(
      page
        .locator('.flow-sdk-node[data-node-id="root.leaf"]')
        .getByRole("button", { name: /^(Collapse|Expand)$/ }),
    ).toHaveCount(0);
  });
}

test("ordinary nodes retain hover handles in selection and draw modes", async ({
  page,
}) => {
  await ready(page, "?custom=1");
  for (const isEdgeHandlesEnabled of [false, true]) {
    await page.evaluate(
      (isEdgeHandlesEnabled) =>
        window.__flowTest.configure({ isEdgeHandlesEnabled }),
      isEdgeHandlesEnabled,
    );
    const collapsible = page.locator('.flow-sdk-node[data-node-id="alpha"]');
    await collapsible.hover();
    await expect(
      collapsible.getByRole("button", { name: "Draw edge", exact: true }),
    ).toHaveCount(0);
    const ordinary = page.locator('.flow-sdk-node[data-node-id="beta"]');
    await ordinary.hover();
    await expect(
      ordinary.getByRole("button", { name: "Draw edge", exact: true }),
    ).toHaveCSS("opacity", "1");
  }
});
