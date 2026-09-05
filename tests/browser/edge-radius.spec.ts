import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`graph radius updates rounded edges at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await ready(page, "?graph=connections");
    await page.evaluate(() =>
      window.__flowTest.configure({ edgeMode: "properties" }),
    );
    await page.mouse.click(10, 10);
    const original = await page.evaluate(() =>
      structuredClone(window.__flowTest.document),
    );
    const trigger = page.getByRole("combobox", {
      name: "Edge radius",
      exact: true,
    });
    await trigger.click();
    const slider = page.getByRole("slider", {
      name: "Edge corner radius",
      exact: true,
    });
    const paths = page.locator(
      ".flow-sdk-edge[data-source-property] .flow-sdk-edge-hit",
    );
    const geometry = () =>
      paths.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("d")),
      );
    expect(await paths.count()).toBeGreaterThan(1);
    await slider.press("Home");
    await expect(slider).toHaveValue("0");
    const sharp = await geometry();
    await slider.fill("100");
    await expect.poll(geometry).not.toEqual(sharp);
    const rounded = await geometry();
    expect(rounded.every((path, index) => path !== sharp[index])).toBe(true);
    await expect(slider).toHaveCSS("border-width", "0px");
    await page.screenshot({ path: testInfo.outputPath("edge-radius.png") });
    await slider.press("Home");
    await expect.poll(geometry).toEqual(sharp);
    expect(await page.evaluate(() => window.__flowTest.document)).toEqual(
      original,
    );
    expect(
      await page.evaluate(() =>
        window.__flowTest.events.some(
          (event) => event.name === "edgeRadius" && event.value === 100,
        ),
      ),
    ).toBe(true);
    await slider.press("Escape");
    await expect(trigger).toBeFocused();
    await page.evaluate(() => window.__flowTest.configure({ readOnly: true }));
    await expect(trigger).toBeDisabled();
  });
}

test("controlled radius remains authoritative and clamps invalid bounds", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => window.__flowTest.configure({ edgeRadius: 50 }));
  await page.mouse.click(10, 10);
  await page
    .getByRole("combobox", { name: "Edge radius", exact: true })
    .click();
  const slider = page.getByRole("slider", {
    name: "Edge corner radius",
    exact: true,
  });
  await slider.press("Home");
  await expect(slider).toHaveValue("50");
  await page.evaluate(() => window.__flowTest.configure({ edgeRadius: 1000 }));
  await expect(slider).toHaveValue("500");
  await page.evaluate(() => window.__flowTest.configure({ edgeRadius: -5 }));
  await expect(slider).toHaveValue("0");
});
