import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  for (const structured of [false, true]) {
    test(`node form errors match delete color, structured=${structured}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, "graph=basic-json");
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.evaluate((structured) => {
        window.__flowTest.replaceDocument({
          $hideRoot: true,
          sample: { $label: "Sample", $view: "object" },
        });
        window.__flowTest.configure({
          formSchema: {
            Sample: {
              kind: "object",
              properties: { name: { type: { kind: "string" } } },
              additionalProperties: { kind: "json" },
            },
          },
        });
        window.__flowTest.replaceForms({
          structured,
          state: { sample: { name: "" } },
          bindings: { "root.sample": { address: "root.sample", type: "Sample" } },
        });
      }, structured);
      const node = page.locator('.flow-sdk-node[data-node-id="root.sample"]');
      await node.locator('p[title="Sample"]').dblclick();
      const form = page.getByRole("dialog", { name: "Configure Sample", exact: true });
      await expect(form.getByRole("alert")).toHaveCount(1);
      if (structured) {
        await form.getByRole("textbox", { name: "Property name", exact: true }).fill("$view");
        await form.getByRole("button", { name: "Add property", exact: true }).click();
        await expect(form.getByRole("alert")).toHaveCount(2);
      }
      const deleteButton = page.locator('[aria-label="Delete selected nodes"]');
      for (const colorMode of ["light", "dark", "light"] as const) {
        await page.evaluate((colorMode) => window.__flowTest.configure({ colorMode }), colorMode);
        await expect.poll(() => deleteButton.evaluate((element) => getComputedStyle(element).color))
          .toBe(await page.evaluate((colorMode) => {
            const probe = document.createElement("span");
            probe.style.color = `var(--chakra-colors-red-${colorMode === "dark" ? "300" : "500"})`;
            document.body.append(probe);
            const color = getComputedStyle(probe).color;
            probe.remove();
            return color;
          }, colorMode));
        const deleteColor = await deleteButton.evaluate((element) => getComputedStyle(element).color);
        for (const alert of await form.getByRole("alert").all()) {
          await expect(alert).toHaveCSS("color", deleteColor);
        }
      }
      await page.evaluate(() => window.__flowTest.replaceForms({
        state: {},
        bindings: { "root.sample": { address: "root.missing", type: "Sample" } },
      }));
      const unavailable = form.getByRole("alert");
      await expect(unavailable).toHaveText("Bound form state is unavailable.");
      for (const colorMode of ["dark", "light"] as const) {
        await page.evaluate((colorMode) => window.__flowTest.configure({ colorMode }), colorMode);
        await expect.poll(async () => {
          const alertColor = await unavailable.evaluate((element) => getComputedStyle(element).color);
          const deleteColor = await deleteButton.evaluate((element) => getComputedStyle(element).color);
          return alertColor === deleteColor;
        }).toBe(true);
      }
      expect(errors).toEqual([]);
    });
  }
}