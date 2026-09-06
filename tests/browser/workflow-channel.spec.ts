import { expect, test, type WebSocketRoute } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

test("workflow channel drives mapped SDK actions and ignores unrelated executions", async ({ page }) => {
  const rooms: string[] = [];
  let channel: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/ws(?:\?.*)?$/, socket => {
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw));
      if (message.type === "auth") socket.send(JSON.stringify({ type: "authenticated" }));
      if (message.type === "join_room") {
        rooms.push(message.room);
        channel = socket;
        socket.send(JSON.stringify({ type: "room_joined", room: message.room }));
      }
    });
  });
  await page.goto(process.env.SDK_TEST_URL!);
  const pick = async (name: string, value: string) => {
    await page.getByRole("combobox", { name, exact: true }).click();
    await page.getByRole("listbox", { name, exact: true }).getByRole("option", { name: value, exact: true }).click();
  };
  await pick("Example dataset", "Workflow State 2");
  await pick("Control examples", "Execution");
  await page.getByRole("textbox", { name: "Execution ID", exact: true }).fill("sdk-execution-test");
  await page.getByRole("button", { name: "Connect workflow channel", exact: true }).click();
  await expect(page.getByRole("status", { name: "Workflow channel status", exact: true })).toHaveText("subscribed");
  expect(rooms).toContain("workflow:sdk-execution-test");
  const normalize = page.locator('.flow-sdk-node[data-node-id="root.step_normalize_status"]');
  const send = (event: Record<string, unknown>) => channel!.send(JSON.stringify({ executionId: "sdk-execution-test", ...event }));
  send({ type: "step_started", step: "normalize_status" });
  await expect(normalize.locator(".flow-sdk-node-animation")).toHaveCount(1);
  send({ type: "step_completed", step: "normalize_status", executionId: "another-execution" });
  send({ type: "mcp_node_view", node: "normalize_status", mode: "properties" });
  await expect(normalize.locator('[data-flow-inspection-row][data-flow-property="value"]')).toHaveCount(1);
  await expect(normalize.locator(".flow-sdk-node-animation")).toHaveCount(1);
  send({ type: "step_completed", step: "normalize_status" });
  await expect(normalize.locator(".flow-sdk-node-animation")).toHaveCount(0);
  send({ type: "mcp_node_view", node: "normalize_status", mode: "default" });
  await expect(normalize.locator("[data-flow-icon-label]")).toHaveCount(1);
  send({ type: "step_started", step: "normalize_status" });
  await expect(normalize.locator(".flow-sdk-node-animation")).toHaveCount(1);
  send({ type: "workflow_completed" });
  await expect(page.locator(".flow-sdk-node-animation")).toHaveCount(0);
  await page.getByRole("button", { name: "Disconnect workflow channel", exact: true }).click();
  await expect(page.getByRole("status", { name: "Workflow channel status", exact: true })).toHaveText("disconnected");
  await expect(page.getByTestId("workflow-channel")).toHaveCount(0);
});