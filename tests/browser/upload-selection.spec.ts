import { expect, test } from "@playwright/test";

test("interface upload survives selecting a node while parsing", async ({
  page,
}) => {
  await page.goto("/?graph=json");
  await page.waitForFunction(
    () => !!window.__flowTest?.engine?.getNodeBox("root.workflow"),
  );
  await page.mouse.click(10, 10);
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise<void>((resolve) =>
        document.addEventListener("finish-interface-read", () => resolve(), {
          once: true,
        }),
      );
      return original.call(this);
    };
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Upload workflow interface", exact: true })
    .click();
  await (
    await chooserPromise
  ).setFiles("examples/workflow-form/supported-interface.ts");
  const node = page.locator('.flow-sdk-node[data-node-id="root.workflow"]');
  await node.getByText("Workflow", { exact: true }).click();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("finish-interface-read")),
  );
  await expect(node.locator('[aria-haspopup="dialog"]')).toHaveCount(1);
  await node.getByText("Workflow", { exact: true }).dblclick();
  await expect(
    page.getByRole("dialog", { name: "Configure Workflow", exact: true }),
  ).toBeVisible();
});
