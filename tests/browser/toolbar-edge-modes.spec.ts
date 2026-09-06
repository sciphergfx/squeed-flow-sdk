import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`toolbar separates node and property tools and retains shared actions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    const toolbar = page.getByRole("toolbar", {
      name: "Diagram controls",
      exact: true,
    });
    await toolbar
      .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
      .click();
    const mode = toolbar.getByRole("combobox", {
      name: "Edge mode",
      exact: true,
    });
    const array = toolbar.getByRole("button", {
      name: "Toggle array mode",
      exact: true,
    });
    const upload = toolbar.getByRole("button", {
      name: "Upload workflow interface",
      exact: true,
    });
    await array.click();
    await expect(array).toHaveAttribute("title", "Array Mode [ ]");
    for (const option of [
      "Properties",
      "Nodes",
      "Auto",
      "Properties",
      "Nodes",
    ]) {
      await chooseToolbarOption(mode, option);
      if (option === "Properties") await expect(array).toHaveCount(0);
      else await expect(array).toHaveAttribute("title", "Array Mode [ ]");
      if (option === "Nodes") await expect(upload).toBeHidden();
      else await expect(upload).toBeVisible();
      for (const name of [
        "Pin",
        "Zoom in",
        "Zoom out",
        "Reset zoom",
        "Toggle zoom mode",
        "Toggle drag mode",
        "Toggle multi-select",
        "Toggle draw mode",
        "Connected nodes",
        "Download SVG",
      ]) {
        await expect(
          toolbar.getByRole("button", { name, exact: true }),
        ).toBeVisible();
      }
      for (const name of [
        "Node spacing",
        "Edge radius",
        "Background variant",
      ]) {
        await expect(
          toolbar.getByRole("combobox", { name, exact: true }),
        ).toBeVisible();
      }
      await expect(toolbar.getByRole("button").first()).toHaveAttribute(
        "aria-label",
        "Pin",
      );
    }
    await chooseToolbarOption(mode, "Properties");
    await mode.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath("properties-toolbar.png"),
    });
  });
}
