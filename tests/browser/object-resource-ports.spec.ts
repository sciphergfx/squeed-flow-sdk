import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`native object rows bind nested resources to their declared ports at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const pick = async (name: string, value: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page.getByRole("listbox", { name, exact: true }).getByRole("option", { name: value, exact: true }).click();
    };
    await pick("Example dataset", "Workflow State 2");
    const target = page.locator('.flow-sdk-node[data-node-id="root.step_mark_running"]');
    await expect(page.locator('.flow-sdk-edge[data-target-property="config:data"]')).toHaveCount(3);
    await page.getByRole("button", { name: "View JSON", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "JSON JSON", exact: true });
    const json = JSON.parse(await editor.inputValue());
    const sourceId = Object.keys(json).find(key => key.startsWith("resource_") && json[key].$connections?.some(connection => connection.target === "root.step_mark_running" && connection.targetProperty === "config:data"))!;
    const originalLinks = json[sourceId].$connections;
    json.step_mark_running.$view = "object";
    await editor.fill(JSON.stringify(json, null, 2));
    await page.getByRole("button", { name: "View JSON", exact: true }).click();
    const row = target.locator('[data-flow-inspection-row][data-flow-property="config:data"]');
    const port = target.getByRole("button", { name: "Input config:data", exact: true });
    await expect(row).toHaveCount(1);
    await expect(port).toHaveCount(1);
    const edge = page.locator('.flow-sdk-edge[data-target-property="config:data"]').filter({ has: page.locator("path") });
    await expect(edge).toHaveCount(3);
    await expect.poll(async () => {
      const rowBounds = (await row.boundingBox())!, portBounds = (await port.boundingBox())!;
      return Math.abs(rowBounds.y + rowBounds.height / 2 - portBounds.y - portBounds.height / 2);
    }).toBeLessThan(1);
    await expect.poll(async () => page.locator('.flow-sdk-edge[data-target-property="config:data"]').evaluateAll((elements, id) => {
      const connection = elements.find(element => element.getAttribute("data-edge-id")?.includes(id));
      const path = connection?.querySelector("path") as SVGPathElement | null;
      const row = document.querySelector('.flow-sdk-node[data-node-id="root.step_mark_running"] [data-flow-inspection-row][data-flow-property="config:data"]');
      if (!path || !row) return Infinity;
      const point = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM()!);
      const bounds = row.getBoundingClientRect();
      return Math.abs(point.y - bounds.y - bounds.height / 2);
    }, sourceId)).toBeLessThan(1);
    await page.getByRole("button", { name: "View JSON", exact: true }).click();
    expect(JSON.parse(await editor.inputValue())[sourceId].$connections).toEqual(originalLinks);
    expect(errors).toEqual([]);
  });
}