import { expect, test, type Locator } from "@playwright/test";
import { ready } from "./helpers";

async function expectHoverLabels(container: Locator) {
  const missing = await container.locator("button").evaluateAll((buttons) =>
    buttons
      .filter(
        (button) =>
          button.querySelector("svg") &&
          !button.textContent?.trim() &&
          button.getBoundingClientRect().height > 0,
      )
      .filter((button) => !button.title.trim())
      .map((button) => button.getAttribute("aria-label")),
  );
  expect(missing).toEqual([]);
}

for (const colorMode of ["light", "dark"] as const) {
  test(`icon controls expose hover helpers in ${colorMode}`, async ({
    page,
  }) => {
    await ready(page, "?graph=json");
    await page.evaluate(
      (colorMode) => window.__flowTest.configure({ colorMode }),
      colorMode,
    );
    await page.mouse.click(10, 10);
    const toolbar = page.getByRole("toolbar", { name: "Diagram controls" });
    await expectHoverLabels(toolbar);
    const pin = page.getByRole("button", { name: "Pin", exact: true });
    await expect(pin).toHaveAttribute("title", "Unpin");
    await page.getByRole("button", { name: "Reset zoom", exact: true }).hover();
    await expect(page.getByRole("tooltip")).toContainText("Reset Zoom");
    const draw = page.getByRole("button", {
      name: "Toggle draw mode",
      exact: true,
    });
    await draw.hover();
    const drawTip = page.getByRole("tooltip", {
      name: "Draw Mode Off",
      exact: true,
    });
    await expect(drawTip).toBeVisible();
    await expect(drawTip).toHaveCSS("border-radius", "15px");
    expect(
      await drawTip.evaluate(
        (element) => !!element.closest("[data-flow-toolbar-scroll]"),
      ),
    ).toBe(false);
    await expect
      .poll(async () => {
        const tip = await drawTip.boundingBox();
        const button = await draw.boundingBox();
        return !!tip && !!button && tip.y + tip.height <= button.y;
      })
      .toBe(true);
    await page
      .locator('.flow-sdk-node[data-node-id="root.alpha"] p')
      .first()
      .click();
    await expectHoverLabels(toolbar);
    const radius = page.getByRole("combobox", {
      name: "Node border radius",
      exact: true,
    });
    await radius.hover();
    await expect(radius).toHaveAttribute("title", /^Border radius: /);
    await page
      .getByRole("button", { name: "Choose node icon", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Choose node icon",
      exact: true,
    });
    await expectHoverLabels(dialog);
    const close = dialog.getByRole("button", {
      name: "Close icon picker",
      exact: true,
    });
    await close.hover();
    await expect(close).toHaveAttribute("title", "Close icon picker");
    await close.click();
    await page.locator(".flow-sdk-edge").first().dispatchEvent("click");
    await expectHoverLabels(toolbar);
    const input = page.getByRole("textbox", { name: "Edge icon", exact: true });
    await input.fill("PiGear");
    await input.press("Enter");
    await expect(page.locator(".flow-sdk-edge-icon > title")).toHaveText(
      "Edge icon",
    );
    const label = page.getByRole("textbox", {
      name: "Edge label",
      exact: true,
    });
    await label.fill("Approved");
    await label.press("Enter");
    await expect(page.locator(".flow-sdk-edge-icon > title")).toHaveText(
      "Edge icon: Approved",
    );
  });
}
