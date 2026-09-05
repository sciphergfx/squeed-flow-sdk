import { expect, test } from "@playwright/test";
import { clearEvents, ready } from "./helpers";

for (const wrapped of [false, true]) {
  test(`${wrapped ? "wrapped" : "plain"} array labels save, reopen and save again without replacing nodes`, async ({
    page,
  }) => {
    await ready(page, "?graph=json");
    await page.evaluate((wrapped) => {
      const tags = ["beta", "eu-west-1", "pci-dss"];
      window.__flowTest.replaceDocument({ tags: wrapped ? { $: tags } : tags });
    }, wrapped);
    const node = page.locator('.flow-sdk-node[data-node-id="root.tags.1"]');
    const label = node.locator("p[title]");
    await expect(label).toHaveText("eu-west-1");
    const ids = await page
      .locator(".flow-sdk-node")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-node-id")),
      );
    for (const [nextLabel, commit] of [
      ["eu-central-1", "Enter"],
      ["ap-south-1", "blur"],
    ]) {
      await label.dblclick();
      const input = node.getByRole("textbox");
      await expect(input).toBeFocused();
      await clearEvents(page);
      await input.press("ControlOrMeta+A");
      await input.pressSequentially(nextLabel);
      if (commit === "Enter") await input.press("Enter");
      else await page.mouse.click(10, 10);
      await expect(input).toHaveCount(0);
      await expect(label).toHaveText(nextLabel);
      const tags = await page.evaluate(() => window.__flowTest.document.tags);
      expect(wrapped ? tags.$ : tags).toEqual(["beta", nextLabel, "pci-dss"]);
      expect(
        await page
          .locator(".flow-sdk-node")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("data-node-id")),
          ),
      ).toEqual(ids);
      expect(
        await page.evaluate(() =>
          window.__flowTest.events.filter((event) => event.name === "json"),
        ),
      ).toHaveLength(1);
      expect(
        await page.evaluate(() =>
          window.__flowTest.events.filter(
            (event) => event.name === "remove-edge",
          ),
        ),
      ).toEqual([]);
    }
    await node.click();
    const toolbarInput = page.getByRole("textbox", {
      name: "Node label",
      exact: true,
    });
    await expect(toolbarInput).toHaveValue("ap-south-1");
    await toolbarInput.fill("eu-west-1");
    await toolbarInput.press("Enter");
    await expect(label).toHaveText("eu-west-1");
    await label.dblclick();
    await node.getByRole("textbox").fill("Cancelled");
    await node.getByRole("textbox").press("Escape");
    await expect(label).toHaveText("eu-west-1");
  });
}
