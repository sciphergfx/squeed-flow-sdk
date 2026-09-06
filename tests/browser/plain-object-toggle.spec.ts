import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  for (const customIcon of [false, true]) {
    test(`plain object toggles without changing data (${customIcon ? "custom icon, no label" : "generic icon"}, ${width}px)`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize({ width, height: 950 });
      await page.goto(process.env.SDK_TEST_URL!);
      await chooseToolbarOption(page.getByRole("combobox", { name: "Control examples", exact: true }), "Parent");
      await chooseToolbarOption(page.getByRole("combobox", { name: "Parent style", exact: true }), "Default");
      await page.getByTestId("json-toggle").click();
      const editor = page.getByRole("textbox", { name: "JSON JSON", exact: true });
      const document = {
        payload: {
          $label: customIcon ? "" : "Payload",
          ...(customIcon ? { $icon: "PiCube" } : {}),
          status: "ready",
          $connections: [{ id: "status-link", target: "root.receiver", sourceProperty: "status", targetProperty: "status" }],
        },
        receiver: { $label: "Receiver", status: "waiting" },
      };
      await editor.fill(JSON.stringify(document, null, 2));
      await page.getByTestId("json-toggle").click();
      const node = page.locator('.flow-sdk-node[data-node-id="root.payload"]');
      const row = node.locator('[data-flow-inspection-row][data-flow-property="status"]');
      const links = page.locator('.flow-sdk-edge[data-source-property="status"][data-target-property="status"]');
      await expect(row).toContainText("ready");
      await expect(links).toHaveCount(1);
      await expect(node.locator("[data-flow-content-toggle]")).toHaveCount(0);
      await node.locator("[data-flow-node-surface]").click();
      await node.getByRole("button", { name: "Show icon", exact: true }).click();
      await expect(row).toHaveCount(0);
      await expect(node.locator("[data-flow-icon-label]")).toHaveCount(1);
      await expect(node.locator("[data-flow-node-surface] svg")).toHaveCount(1);
      await expect(node.locator("[data-flow-icon-caption]")).toHaveText(customIcon ? "" : "Payload");
      await expect(links).toHaveCount(1);
      await page.getByRole("button", { name: "Close selection tools", exact: true }).click();
      await expect(node.locator("[data-flow-content-toggle]")).toHaveCount(0);
      await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
      await node.locator("[data-flow-node-surface]").click();
      await page.screenshot({ path: test.info().outputPath("plain-object-icon.png") });
      await node.getByRole("button", { name: "Show properties", exact: true }).click();
      await expect(row).toContainText("ready");
      await expect(node.locator("[data-flow-icon-label]")).toHaveCount(0);
      await expect(links).toHaveCount(1);
      await page.getByTestId("json-toggle").click();
      expect(JSON.parse(await editor.inputValue())).toEqual(document);
      expect(errors).toEqual([]);
    });
  }
}