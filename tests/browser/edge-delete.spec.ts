import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const action of ["Backspace", "Delete", "toolbar"]) {
  test(`${action} deletes a selected property connection without deleting nodes`, async ({ page }) => {
    await ready(page, "?graph=connections");
    await page.evaluate(() => window.__flowTest.configure({ edgeMode: "properties" }));
    const nodes = await page.locator(".flow-sdk-node").count();
    const connection = page.locator('.flow-sdk-edge[data-source-property="api"]');
    await connection.locator(".flow-sdk-edge-hit").dispatchEvent("click");
    await expect(page.getByRole("button", { name: "Delete edge", exact: true })).toBeVisible();
    if (action === "toolbar") await page.getByRole("button", { name: "Delete edge", exact: true }).click();
    else await page.keyboard.press(action);
    await expect(connection).toHaveCount(0);
    await expect(page.locator(".flow-sdk-node")).toHaveCount(nodes);
    const document = await page.evaluate(() => window.__flowTest.document);
    expect(document.alpha.$connections).toHaveLength(1);
    expect(document.alpha.$connections[0].sourceProperty).toBe("runtime");
    expect(document.alpha.$target).toBe("root.gamma");
  });
}