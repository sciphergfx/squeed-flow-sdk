import { expect, test } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`simple MCP pricing modal works at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(process.env.SDK_TEST_URL!);
    const trigger = page.getByTestId("mcp-indicator");
    await expect(trigger).toHaveAccessibleName("MCP pricing");
    for (const theme of ["dark", "light"]) {
      if (theme === "light") await page.getByTestId("theme-toggle").click();
      await trigger.click();
      const modal = page.getByRole("dialog", { name: /MCP bridge pricing/ });
      await expect(modal).toBeVisible();
      await expect(modal).toHaveCSS("opacity", "1");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(modal).not.toContainText(
        /\$5 minimum|Team|Per workspace, plus bridge usage|\$29 \/ month/,
      );
      const plans = modal.locator("dl > div");
      await expect(plans).toHaveCount(2);
      const freePlan = plans.filter({
        has: page.locator("dt").filter({ hasText: /^Free/ }),
      });
      const paidPlan = plans.filter({
        has: page.locator("dt").filter({ hasText: /^Pay as you go/ }),
      });
      await expect(freePlan.locator("dd")).toHaveText("$0");
      await expect(freePlan).toContainText("Selected MCP tools, free to use");
      await expect(paidPlan).toContainText(
        "All MCP tools, usage-based pricing",
      );
      await expect(paidPlan.locator("dd")).toHaveCount(0);
      await expect(modal).toContainText("$1 per 10,000 paid bridge requests");
      await expect(modal).toContainText(
        "Charges cover paid bridge requests only.",
      );
      await expect(modal).toContainText(
        "AI model and downstream service costs are separate.",
      );
      await expect(modal).not.toContainText(
        /no hosted bridge|Bridge balance|tool execution are not included/i,
      );
      await expect(modal).not.toContainText(
        /bring your own|BYOK|model key|compute and model usage are separate/i,
      );
      await expect(modal).not.toContainText(
        /Proposed bridge pricing|rates pending cost validation|Preview only|no funds added/i,
      );
      const addFunds = modal.getByRole("button", { name: /^Add \$/ });
      await expect(addFunds).toHaveText(
        theme === "dark" ? "Add $5" : "Add $10",
      );
      await expect(addFunds).toBeDisabled();
      await expect(addFunds.locator("..")).toHaveAttribute(
        "title",
        "Checkout not connected",
      );
      const slider = modal.getByRole("slider", {
        name: "Bridge requests",
        exact: true,
      });
      await expect(slider).toBeFocused();
      await expect(slider).toHaveAttribute("min", "50000");
      await expect(slider).toHaveAttribute("max", "2500000");
      await expect(slider).toHaveAttribute("step", "50000");
      if (theme === "dark") {
        await expect(slider).toHaveValue("50000");
        await expect(
          modal.getByLabel("Selected bridge requests", { exact: true }),
        ).toHaveText("50,000");
      }
      await slider.press("End");
      await expect(slider).toHaveValue("2500000");
      await expect(
        modal.getByLabel("Selected bridge requests", { exact: true }),
      ).toHaveText("2,500,000");
      await expect(addFunds).toHaveText("Add $250");
      await expect(slider).toHaveAttribute(
        "aria-valuetext",
        "2,500,000 bridge requests for $250",
      );
      expect(
        await modal.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await slider.press("Home");
      await expect(slider).toHaveValue("50000");
      await expect(addFunds).toHaveText("Add $5");
      await slider.press("ArrowRight");
      await expect(slider).toHaveValue("100000");
      await expect(addFunds).toHaveText("Add $10");
      await expect(
        modal.getByLabel("Selected bridge requests", { exact: true }),
      ).toHaveText("100,000");
      await slider.press("Tab");
      expect(
        await modal.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
      const bounds = (await modal.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
      expect(
        await modal.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/squeed-mcp-pricing-${theme}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await trigger.press("Enter");
      await expect(modal.getByRole("slider")).toHaveValue("100000");
      await modal
        .getByRole("button", { name: "Close MCP pricing", exact: true })
        .click();
      await expect(modal).toBeHidden();
    }
    await expect(trigger).toHaveAttribute("data-connected", "false");
    expect(errors).toEqual([]);
  });
}
