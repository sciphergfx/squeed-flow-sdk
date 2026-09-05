import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

test("property-only leaves have no collapse control, including stale metadata", async ({
  page,
}) => {
  await ready(page, "?graph=json");
  for (const collapsed of [false, true]) {
    await page.evaluate(
      (collapsed) =>
        window.__flowTest.replaceDocument({
          branch: { child: { maxAttempts: 3, $collapsed: collapsed } },
        }),
      collapsed,
    );
    const leaf = page.locator(
      '.flow-sdk-node[data-node-id="root.branch.child"]',
    );
    await expect(leaf).toBeVisible();
    await expect(
      leaf.getByRole("button", { name: /^(Collapse|Expand)$/ }),
    ).toHaveCount(0);
    await leaf.getByText("child", { exact: true }).click();
    await expect(
      page.getByRole("button", { name: /^(Collapse|Expand) node$/ }),
    ).toHaveCount(0);
    const branch = page.locator('.flow-sdk-node[data-node-id="root.branch"]');
    await branch.getByRole("button", { name: "Collapse", exact: true }).click();
    await expect(leaf).toHaveCount(0);
    await branch.getByRole("button", { name: "Expand", exact: true }).click();
    await expect(leaf).toBeVisible();
  }
});
