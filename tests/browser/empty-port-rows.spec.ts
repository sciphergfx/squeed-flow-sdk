import { expect, test } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390]) {
  test(`empty connected rows show labels only without changing ports at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Control examples", exact: true }),
      "Parent",
    );
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Parent style", exact: true }),
      "Default",
    );
    await page.getByTestId("json-toggle").click();
    const editor = page.getByRole("textbox", {
      name: "JSON JSON",
      exact: true,
    });
    const document = {
      decision: {
        $label: "Decision",
        $bgColor: "green.600",
        condition: "Is ready?",
        empty: "",
        incoming: "",
        zero: 0,
        boolean: false,
        true: "",
        false: "",
        $connections: ["true", "false", "zero", "boolean"].map((key) => ({
          id: key,
          target: "root.result",
          sourceProperty: key,
          targetProperty: "value",
        })),
      },
      result: {
        $label: "Result",
        value: "",
        $connections: [
          {
            id: "incoming",
            target: "root.decision",
            sourceProperty: "value",
            targetProperty: "incoming",
          },
        ],
      },
    };
    await editor.fill(JSON.stringify(document));
    await page.getByTestId("json-toggle").click();
    const node = page.locator('.flow-sdk-node[data-node-id="root.decision"]');
    const row = (key: string) =>
      node.locator(`[data-flow-inspection-row][data-flow-property="${key}"]`);
    for (const key of ["true", "false", "incoming"]) {
      await expect(row(key).locator("p")).toHaveCount(1);
      await expect(row(key).locator("p")).toHaveCSS("text-align", key === "incoming" ? "left" : "right");
      await expect(row(key)).toHaveText(key);
      const labelCell = row(key).locator("p").locator("..");
      await expect(labelCell).toHaveCSS("border-right-width", "0px");
      await expect
        .poll(async () =>
          Math.abs(
            (await labelCell.boundingBox())!.width -
              (await row(key).boundingBox())!.width,
          ),
        )
        .toBeLessThan(1);
    }
    for (const key of ["empty", "zero", "boolean", "condition"]) {
      await expect(row(key).locator("p")).toHaveCount(2);
      await expect(row(key).locator("p").first()).toHaveCSS("text-align", "left");
    }
    await expect(row("zero")).toContainText("0");
    await expect(row("boolean")).toContainText("false");
    const labels = await node
      .locator("[data-flow-inspection-row]")
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-flow-property")),
      );
    expect(labels.slice(-2)).toEqual(["true", "false"]);
    await expect(
      page.locator(
        ".flow-sdk-edge[data-source-property][data-target-property]",
      ),
    ).toHaveCount(5);
    for (const key of ["true", "false"]) {
      const port = node.getByRole("button", {
        name: `Connect ${key}`,
        exact: true,
      });
      await expect
        .poll(async () => {
          const bounds = (await row(key).boundingBox())!,
            anchor = (await port.boundingBox())!;
          return Math.abs(
            bounds.y + bounds.height / 2 - anchor.y - anchor.height / 2,
          );
        })
        .toBeLessThan(1);
    }
    await page.screenshot({
      path: test.info().outputPath("empty-connected-rows.png"),
    });
    await page.getByTestId("json-toggle").click();
    expect(JSON.parse(await editor.inputValue())).toEqual(document);
    await editor.fill(
      JSON.stringify({
        ...document,
        decision: { ...document.decision, $connections: [] },
      }),
    );
    await page.getByTestId("json-toggle").click();
    await expect(row("true").locator("p")).toHaveCount(2);
    await expect(row("false").locator("p")).toHaveCount(2);
    expect(errors).toEqual([]);
  });
}
