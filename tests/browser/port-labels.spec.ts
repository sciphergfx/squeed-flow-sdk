import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`resource output labels preserve connector identifiers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "graph=basic-json");
    await page.evaluate(() => {
      window.__flowTest.configure({ edgeMode: "properties", isEdgeHandlesEnabled: false });
      window.__flowTest.replaceDocument({
        $hideRoot: true,
        resource: {
          $view: "object",
          $label: "Knowledge Entries",
          name: "Knowledge Entries",
          entityType: "knowledge_entry",
          $ports: [{ id: "output:resource", label: "output", role: "source", side: "right" }],
          $connections: [{ target: "root.consumer", sourceProperty: "output:resource", targetProperty: "input:input" }],
        },
        consumer: {
          $view: "object",
          $label: "Consumer",
          $ports: [{ id: "input:input", role: "target", side: "left" }],
        },
      });
    });
    const output = page.locator('[data-flow-property="output:resource"]:visible');
    await expect(output).toHaveText("output");
    await expect(output).toHaveAttribute("data-flow-port-role", "source");
    await expect(page.locator('[data-flow-property="input:input"]:visible')).toHaveText("input");
    await expect(page.getByText("knowledge_entry", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__flowTest.document.resource.$connections[0].sourceProperty)).toBe("output:resource");
    await page.screenshot({ path: test.info().outputPath("resource-output.png") });
    await page.evaluate(() => {
      const next = structuredClone(window.__flowTest.document);
      delete next.resource.$ports[0].label;
      window.__flowTest.replaceDocument(next);
    });
    await expect(output).toHaveText("resource");
  });
}