import { expect, test, type WebSocketRoute } from "@playwright/test";
import { chooseToolbarOption } from "./helpers";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");
for (const width of [1440, 390])
  test(`Backflow generation previews partial JSON and commits safely at ${width}px`, async ({
    page,
  }) => {
    let socket: WebSocketRoute;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.routeWebSocket(/\/ws(?:\?.*)?$/, (route) => {
      socket = route;
      route.onMessage((raw) => {
        const message = JSON.parse(String(raw));
        if (message.type === "auth")
          route.send(JSON.stringify({ type: "authenticated" }));
        if (message.type === "join_room")
          route.send(
            JSON.stringify({ type: "room_joined", room: message.room }),
          );
      });
    });
    await page.goto(process.env.SDK_TEST_URL!);
    const dataset = page.getByRole("combobox", {
      name: "Example dataset",
      exact: true,
    });
    await chooseToolbarOption(dataset, "AI Diagram");
    const connect = async (id: string) => {
      await page
        .getByRole("textbox", { name: "Execution ID", exact: true })
        .fill(id);
      await page
        .getByRole("button", { name: "Connect workflow channel", exact: true })
        .click();
      await expect(
        page.getByRole("status", {
          name: "Workflow channel status",
          exact: true,
        }),
      ).toHaveText("subscribed");
    };
    const send = (id: string, type: string, data = {}) =>
      socket.send(JSON.stringify({ type, executionId: id, data }));
    const snapshot = (id: string, chunk: string, complete = false) =>
      send(id, "llm_output_chunk", { chunk, length: chunk.length, complete });
    const status = page.getByRole("status", {
      name: "Diagram generation status",
      exact: true,
    });
    await connect("stream-test");
    send("foreign", "squeed_generation_started", { requestId: "one" });
    snapshot("foreign", '{"foreign":{}}', true);
    send("stream-test", "squeed_generation_started", { requestId: "one" });
    await expect(status).toHaveText("streaming");
    snapshot("stream-test", '{"start":{"$label":"First');
    const start = page.locator('[data-node-id="root.start"]');
    await expect(start).toContainText("First");
    await expect(page.locator('[data-node-id="root.foreign"]')).toHaveCount(0);
    snapshot(
      "stream-test",
      '{"start":{"$label":"First"},"bad":{"__proto__":{}}',
    );
    await expect(start).toContainText("First");
    const complete =
      '{"start":{"$label":"First node","$target":"root.end"},"end":{"$label":"Done"}}';
    snapshot("stream-test", complete, true);
    await expect(page.locator('[data-node-id="root.end"]')).toContainText(
      "Done",
    );
    await expect(status).toHaveText("streaming");
    send("stream-test", "squeed_generation_completed", { requestId: "one" });
    await expect(status).toHaveText("complete");
    await expect(start).toContainText("First node");
    await expect(
      page.getByRole("status", { name: "Loading diagram", exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page.locator('[data-node-id="root.end"]').evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.width > 0 && bounds.left >= 0 && bounds.right <= innerWidth
          );
        }),
      )
      .toBe(true);
    await page.mouse.move(8, 500);
    await page
      .getByRole("region", { name: "SDK control examples", exact: true })
      .getByRole("button", { name: "Close selection tools", exact: true })
      .click();
    await expect(page.locator('[data-node-id="root.end"]')).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("generation-complete.png"),
    });
    await chooseToolbarOption(
      page.getByRole("combobox", { name: "Control examples", exact: true }),
      "Execution",
    );

    await connect("invalid-test");
    send("invalid-test", "squeed_generation_started", { requestId: "two" });
    snapshot("invalid-test", '{"partial":{"$label":"Temporary', true);
    await expect(page.locator('[data-node-id="root.partial"]')).toBeAttached();
    send("invalid-test", "squeed_generation_completed", { requestId: "two" });
    await expect(status).toHaveText("failed");
    await expect(start).toContainText("First node");
    await expect(page.locator('[data-node-id="root.partial"]')).toHaveCount(0);

    await connect("cancel-test");
    send("cancel-test", "squeed_generation_started", { requestId: "three" });
    snapshot("cancel-test", '{"pending":{}');
    await expect(page.locator('[data-node-id="root.pending"]')).toBeAttached();
    await page
      .getByRole("button", { name: "Disconnect workflow channel", exact: true })
      .click();
    await expect(start).toContainText("First node");
    await expect(page.locator('[data-node-id="root.pending"]')).toHaveCount(0);
    await chooseToolbarOption(dataset, "Mixed Views");
    await expect(page.locator('[data-node-id="shape-start"]')).toBeAttached();
    await expect(page.locator('[data-node-id="root.start"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
