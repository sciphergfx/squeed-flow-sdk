import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`resource edge toolbar edits persist at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await expect(page.locator(".flow-sdk-node").first()).toBeVisible();
    await page
      .getByRole("combobox", { name: "Example dataset", exact: true })
      .click();
    await page
      .getByRole("listbox", { name: "Example dataset", exact: true })
      .getByRole("option", { name: "Workflow State", exact: true })
      .click();
    const label = page.locator(
      '.flow-sdk-edge-label[data-source-property="resource:promptId:user_review"]',
    );
    const edge = page.locator(
      '.flow-sdk-edge[data-source-property="resource:promptId:user_review"]',
    );
    await label.click();
    const animated = page.getByRole("button", {
      name: "Edge style animated",
      exact: true,
    });
    await animated.click();
    await expect(animated).toHaveAttribute("aria-pressed", "true");
    await expect(edge.locator(".flow-sdk-edge-anim")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Edge color teal.500", exact: true })
      .click();
    const stroke = await edge
      .locator(":scope > path")
      .first()
      .getAttribute("stroke");
    const labelInput = page.getByRole("textbox", {
      name: "Edge label",
      exact: true,
    });
    await labelInput.fill("Shared prompt");
    await labelInput.press("Enter");
    await expect(label.locator("tspan")).toHaveText(["Shared", "prompt"]);
    const icon = page.getByRole("textbox", { name: "Edge icon", exact: true });
    await icon.fill("PiLink");
    await icon.press("Enter");
    await expect(label.locator(".flow-sdk-edge-icon")).toHaveCount(1);
    await page
      .getByRole("combobox", { name: "Edge shape", exact: true })
      .click();
    await page
      .getByRole("listbox", { name: "Edge shape", exact: true })
      .getByRole("option", { name: "Bezier", exact: true })
      .click();
    await expect(edge.locator(":scope > path").first()).toHaveAttribute(
      "d",
      / C/,
    );
    await page
      .locator('.flow-sdk-node[data-node-id="root.trigger"]')
      .getByText("On Create User", { exact: true })
      .dblclick();
    const form = page.getByRole("dialog", {
      name: "Configure On Create User",
      exact: true,
    });
    await form
      .getByRole("combobox", { name: "Type", exact: true })
      .selectOption({ label: "Manual" });
    await page.keyboard.press("Escape");
    await label.click();
    await expect(animated).toHaveAttribute("aria-pressed", "true");
    await expect(labelInput).toHaveValue("Shared prompt");
    await expect(icon).toHaveValue("PiLink");
    await expect(edge.locator(":scope > path").first()).toHaveAttribute(
      "stroke",
      stroke!,
    );
    await expect(edge.locator(":scope > path").first()).toHaveAttribute(
      "d",
      / C/,
    );
    await page
      .getByRole("button", { name: "Edge style solid", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Edge style solid", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(edge.locator(".flow-sdk-edge-anim")).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("resource-edge-tools.png"),
    });
    expect(errors).toEqual([]);
  });
}
