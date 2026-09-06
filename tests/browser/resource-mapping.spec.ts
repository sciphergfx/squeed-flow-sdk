import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const workflow = JSON.parse(
  readFileSync("examples/workflow-state-2/workflow.json", "utf8"),
);
const mapping = {
  version: 1,
  fields: [
    { type: "CastLlmConfig", field: "prompt" },
    { type: "CastDatabaseConfig", field: "data" },
  ],
};
test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

async function pick(page: Page, name: string, value: string) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page
    .getByRole("listbox", { name, exact: true })
    .getByRole("option", { name: value, exact: true })
    .click();
}

async function download(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return JSON.parse(readFileSync((await (await pending).path())!, "utf8"));
}

for (const width of [1440, 390]) {
  test(`uploaded schema maps reusable scalar and object fields at ${width}px`, async ({
    page,
  }) => {
    await page.route("**/sdk-test/resourceMappings.ts*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "export const SDK_RESOURCE_MAPPINGS = {};",
      }),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(process.env.SDK_TEST_URL!);
    await pick(page, "Example dataset", "Workflow State 2");
    await expect(
      page.getByRole("group", { name: "Reusable configuration", exact: true }),
    ).toHaveCount(0);
    const panel = page.getByRole("region", { name: "SDK control examples" });
    await panel
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-state-2/interface.ts");
    await expect(
      page.getByRole("group", { name: "Reusable configuration", exact: true }),
    ).toBeVisible();
    await pick(page, "Mapping interface", "Cast Llm Config");
    await page
      .getByRole("button", {
        name: "Reusable CastLlmConfig.prompt",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Reusable CastLlmConfig.prompt",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('.flow-sdk-edge[data-target-property="config:prompt"]'),
    ).toHaveCount(1);
    await pick(page, "Mapping interface", "Cast Database Config");
    await page
      .getByRole("button", {
        name: "Reusable CastDatabaseConfig.data",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Reusable CastDatabaseConfig.data",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('.flow-sdk-edge[data-target-property="config:data"]'),
    ).toHaveCount(3);
    const object = page
      .locator('.flow-sdk-node[data-node-id^="root.resource_"]')
      .filter({ hasText: "data: step_link" })
      .filter({ hasNotText: "data: step_link_cast" });
    await expect(object.locator("[data-flow-config-summary]")).toHaveCount(0);
    await expect(object.locator('[aria-haspopup="dialog"]')).toHaveCount(1);
    await expect(object.locator('[data-flow-property="status"]')).toContainText(
      "{{steps.normalize_status.result}}",
    );
    await expect(
      object.locator('[data-flow-property="execution_id"]'),
    ).toContainText("{{execution.id}}");
    expect(await download(page, "Export resource mapping")).toEqual(mapping);
    expect(await download(page, "Export resolved workflow")).toEqual(workflow);
    await panel.screenshot({
      path: test.info().outputPath("resource-mapping-popover.png"),
    });
    await panel
      .getByLabel("Workflow interface file", { exact: true })
      .setInputFiles("examples/workflow-state-2/interface.ts");
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await download(page, "Export resolved workflow")).toEqual(workflow);
    await page
      .getByLabel("Resource mapping file", { exact: true })
      .setInputFiles({
        name: "mapping.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ version: 1, fields: [] })),
      });
    await expect(
      page.locator('.flow-sdk-node[data-node-id^="root.resource_"]'),
    ).toHaveCount(0);
    expect(await download(page, "Export resolved workflow")).toEqual(workflow);
    expect(errors).toEqual([]);
  });
}

test("static resource mapping uses the same import/export path without an upload", async ({
  page,
}) => {
  await page.route("**/sdk-test/resourceMappings.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const SDK_RESOURCE_MAPPINGS = ${JSON.stringify({ "workflow-state-2": mapping })};`,
    }),
  );
  await page.goto(process.env.SDK_TEST_URL!);
  await pick(page, "Example dataset", "Workflow State 2");
  await expect(
    page.locator('.flow-sdk-edge[data-target-property="config:prompt"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.flow-sdk-edge[data-target-property="config:data"]'),
  ).toHaveCount(3);
  expect(await download(page, "Export resource mapping")).toEqual(mapping);
  expect(await download(page, "Export resolved workflow")).toEqual(workflow);
});
