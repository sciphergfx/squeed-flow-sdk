import { expect, test, type Locator } from "@playwright/test";
import { ready } from "./helpers";

async function expectNoRing(control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  await expect(control).toHaveCSS("outline-style", "none");
  await expect(control).toHaveCSS("box-shadow", "none");
}

for (const colorMode of ["light", "dark"] as const) {
  test(`diagram inputs have no focus outlines or shadows in ${colorMode}`, async ({
    page,
  }) => {
    await ready(page, "?graph=json");
    await page.evaluate(
      (colorMode) => window.__flowTest.configure({ colorMode }),
      colorMode,
    );
    const node = page.locator('.flow-sdk-node[data-node-id="root.alpha"]');
    await node.locator("p").first().click();
    await expectNoRing(
      page.getByRole("textbox", { name: "Node label", exact: true }),
    );
    const radius = page.getByRole("combobox", {
      name: "Node border radius",
      exact: true,
    });
    await expectNoRing(radius);
    await radius.selectOption("custom");
    await expectNoRing(
      page.getByRole("spinbutton", {
        name: "Custom border radius",
        exact: true,
      }),
    );
    await expectNoRing(
      page.getByRole("textbox", { name: "Node icon", exact: true }),
    );
    await node.locator("p").first().dblclick();
    await expectNoRing(node.getByRole("textbox"));
    await node.getByRole("textbox").press("Escape");
    await page.locator(".flow-sdk-edge").first().dispatchEvent("click");
    await expectNoRing(
      page.getByRole("textbox", { name: "Edge label", exact: true }),
    );
    await expectNoRing(
      page.getByRole("combobox", { name: "Edge shape", exact: true }),
    );
    await page.evaluate(() =>
      window.__flowTest.replaceDocument({
        alpha: { $label: "Runbook", $content: "Edit content" },
      }),
    );
    await node.getByText("Edit content", { exact: true }).dblclick();
    await expectNoRing(
      node.getByRole("textbox", { name: "Node content", exact: true }),
    );
    await expect(page.locator("[data-flow-toolbar-scroll]")).not.toHaveCSS(
      "box-shadow",
      "none",
    );
  });
}
