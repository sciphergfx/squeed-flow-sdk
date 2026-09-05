import { expect, test } from "@playwright/test";
import { clearEvents, ready } from "./helpers";

for (const type of ["text", "arrayView", "objectView"] as const) {
  test(`${type} raw border edits preserve fill and update the selected outline and animation`, async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate((type) => {
      window.__flowTest.configure({
        selectionToolbar: { palette: ["#14b8a6"] },
      });
      window.__flowTest.replaceGraph({
        nodes: [
          {
            data: {
              id: "alpha",
              type,
              label: "Filled",
              isNodeAnimated: true,
              viewProps: { bgColor: "#29865b", textColor: "#123456" },
            },
          },
        ],
        edges: [],
      });
    }, type);
    const node = page.locator('.flow-sdk-node[data-node-id="alpha"]');
    const surface = node.locator("[data-flow-node-surface]");
    await node.locator("p[title]").click();
    const fill = await surface.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const originalWidth = await surface.evaluate(
      (element) => getComputedStyle(element).borderTopWidth,
    );
    await clearEvents(page);
    await page
      .getByRole("button", { name: "Edit node border", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Border color #14b8a6", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Toggle dashed border", exact: true })
      .click();
    const thickness = page.getByRole("spinbutton", {
      name: "Border thickness",
      exact: true,
    });
    await thickness.fill("12");
    await thickness.press("Enter");
    await expect(surface).toHaveCSS("background-color", fill);
    await expect(surface).toHaveCSS("border-top-color", "rgb(20, 184, 166)");
    await expect(surface).toHaveCSS("border-top-style", "dashed");
    await expect(surface).toHaveCSS("border-top-width", "12px");
    await expect(surface).toHaveCSS("outline-style", "solid");
    await expect(
      node.locator(".flow-sdk-node-border-animation"),
    ).toHaveAttribute("stroke-width", "12");
    await node.locator("p[title]").hover();
    await expect(surface).toHaveCSS("border-top-color", "rgb(20, 184, 166)");
    expect(
      await page.evaluate(() =>
        window.__flowTest.events.filter((event) =>
          [
            "border-color",
            "border-style",
            "border-width",
            "outline",
            "json",
          ].includes(event.name),
        ),
      ),
    ).toEqual([
      { name: "border-color", value: { id: "alpha", color: "#14b8a6" } },
      { name: "border-style", value: { id: "alpha", style: "dashed" } },
      { name: "border-width", value: { id: "alpha", width: 12 } },
    ]);
    await thickness.fill("0");
    await thickness.press("Enter");
    await expect(surface).toHaveCSS("border-top-width", "0px");
    await expect(node.locator(".flow-sdk-node-border-animation")).toHaveCount(
      0,
    );
    await thickness.fill("");
    await thickness.press("Enter");
    await expect(surface).toHaveCSS("border-top-width", originalWidth);
    await expect(
      node.locator(".flow-sdk-node-border-animation"),
    ).toHaveAttribute("stroke-width", "8");
    await page
      .getByRole("button", { name: "Border color transparent", exact: true })
      .click();
    await expect(surface).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(surface).toHaveCSS("background-color", fill);
    await expect(surface).toHaveCSS("outline-style", "solid");
  });
}
