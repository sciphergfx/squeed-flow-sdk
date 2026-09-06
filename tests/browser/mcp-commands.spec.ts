import { expect, test, type WebSocketRoute } from "@playwright/test";

test.skip(!process.env.SDK_TEST_URL, "Requires SDK Test consumer");

for (const width of [1440, 390])
  test(`SDK command bridge applies the full action groups at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let socket: WebSocketRoute;
    await page.routeWebSocket(/\/ws(?:\?.*)?$/, (route) => {
      route.onMessage((raw) => {
        const message = JSON.parse(String(raw));
        if (message.type === "auth")
          route.send(JSON.stringify({ type: "authenticated" }));
        if (message.type === "join_room") {
          socket = route;
          route.send(
            JSON.stringify({ type: "room_joined", room: message.room }),
          );
        }
      });
    });
    await page.addInitScript(() => {
      (window as any).commandResults = [];
      window.addEventListener("squeed:mcp-result", (event) =>
        (window as any).commandResults.push((event as CustomEvent).detail),
      );
    });
    await page.goto(process.env.SDK_TEST_URL!);
    const pick = async (name: string, value: string) => {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page
        .getByRole("listbox", { name, exact: true })
        .getByRole("option", { name: value, exact: true })
        .click();
    };
    await pick("Control examples", "Execution");
    await page
      .getByRole("textbox", { name: "Execution ID", exact: true })
      .fill("sdk-command-test");
    await page
      .getByRole("button", { name: "Connect workflow channel", exact: true })
      .click();
    await expect(
      page.getByRole("status", {
        name: "Workflow channel status",
        exact: true,
      }),
    ).toHaveText("subscribed");
    let sequence = 0;
    const send = async (
      command: string,
      fields: Record<string, unknown> = {},
      status = "applied",
    ) => {
      const requestId = `request-${++sequence}`;
      socket.send(
        JSON.stringify({
          type: "mcp_sdk_command",
          data: {
            executionId: "sdk-command-test",
            command,
            payload: { executionId: "sdk-command-test", requestId, ...fields },
          },
        }),
      );
      socket.send(
        JSON.stringify({
          type: "workflow_completed",
          executionId: "sdk-command-test",
        }),
      );
      await expect
        .poll(() =>
          page.evaluate(
            (id) =>
              (window as any).commandResults.find(
                (result: any) => result.requestId === id,
              ),
            requestId,
          ),
        )
        .toBeTruthy();
      const result = await page.evaluate(
        (id) =>
          (window as any).commandResults.find(
            (result: any) => result.requestId === id,
          ),
        requestId,
      );
      expect(result, JSON.stringify(result)).toMatchObject({ status, command });
      return result.result;
    };
    const graph = await send("inspect");
    const node = graph.nodes[0];
    const edge = graph.edges[0];
    expect(node).toBeTruthy();
    expect(edge).toBeTruthy();
    await send("node-label", { node, label: "MCP changed label" });
    await send("node-content", { node, content: "Command content" });
    await send("node-border-width", { node, width: 4 });
    await send("node-border-radius", { node, radius: 12 });
    await send("node-animation-variant", { node, variant: "pulse" });
    await send("node-animation", { node, animated: true });
    socket.send(
      JSON.stringify({
        type: "workflow_completed",
        executionId: "sdk-command-test",
      }),
    );
    await expect(
      page.locator(`[data-node-id="${node}"] .flow-sdk-node-animation`),
    ).toHaveCount(1);
    await send("edge-label", { edge, label: "MCP edge" });
    await send("edge-style", { edge, style: "dashed" });
    expect((await send("edge-inspect", { edge })).label).toBe("MCP edge");
    await send("theme-color", { color: "green.500" });
    await send("direction", { direction: "TB" });
    await send("color-mode", { mode: "light" });
    let previousGeometry = "";
    let stableSamples = 0;
    await expect
      .poll(async () => {
        const geometry = await page
          .locator(".flow-sdk-node")
          .evaluateAll((nodes) =>
            JSON.stringify(
              nodes.map((node) => {
                const bounds = node.getBoundingClientRect();
                return [bounds.x, bounds.y, bounds.width, bounds.height];
              }),
            ),
          );
        stableSamples = geometry === previousGeometry ? stableSamples + 1 : 0;
        previousGeometry = geometry;
        return stableSamples;
      })
      .toBeGreaterThanOrEqual(3);
    await send("zoom", { zoom: 0.5 });
    await send("pan", { x: 60, y: 80 });
    expect((await send("inspect")).viewport.zoom).toBeCloseTo(0.5);
    await send("fit", { animate: false });
    const document = await send("document-export", { kind: "document" });
    expect(
      document.nodes.find((entry: any) => entry.data.id === node).data.label,
    ).toBe("MCP changed label");
    await send(
      "node-label",
      { node: "not-present", label: "No effect" },
      "rejected",
    );
    await send("edge-type", { edge, type: "unregistered-type" }, "rejected");
    await send("node-create", { type: "text", x: 100, y: 100 });
    const after = await send("inspect");
    const created = after.nodes.find((id: string) => !graph.nodes.includes(id));
    expect(created).toBeTruthy();
    await send("edge-create", { source: node, target: created });
    await send("node-delete", { node: created });
    await send("document-replace", { document });
    expect((await send("inspect")).nodes).toEqual(graph.nodes);
    await page.screenshot({ path: `/tmp/squeed-mcp-commands-${width}.png` });
    await pick("Example dataset", "Workflow State 2");
    await expect(
      page.locator('[data-node-id="root.step_normalize_status"]'),
    ).toBeVisible();
    const configuration = await send("configuration-export");
    expect(configuration.version).toBe(1);
    await send("configuration-replace", { configuration });
    const state = await send("document-export", { kind: "state" });
    await send("state-replace", { state });
    await page.evaluate(async () => {
      const path = "/src/lib/api.ts";
      const { api } = await import(path);
      api.getTenantId = () => "sdk-suggestion-tenant";
    });
    let collectionRequests = 0;
    await page.route("**/tenant/entities", (route) => {
      collectionRequests++;
      return route.fulfill({
        json: { data: [{ collection: "orders" }, { collection: "users" }] },
      });
    });
    const configured = await send("configuration-export");
    configured.bindings.collection.types.database = "DatabaseOptions";
    configured.schema.DatabaseOptions = {
      kind: "object",
      properties: { collection: { type: { kind: "string" } } },
    };
    const stepIndex = configured.source.workflow.steps.length;
    configured.source.workflow.steps.push({
      id: "database_options",
      type: "database",
      name: "Database options",
      config: { collection: "orders" },
    });
    await send("configuration-replace", { configuration: configured });
    const databaseNode = "root.step_database_options";
    const address = `root.workflow.steps.${stepIndex}.config.collection`;
    const options = await send("form-options", {
      node: databaseNode,
      field: address,
    });
    expect(options).toEqual([
      { label: "orders", value: "orders" },
      { label: "users", value: "users" },
    ]);
    await send("form-options", { node: databaseNode, field: "collection" });
    expect(collectionRequests).toBe(1);
    await send("form-set", {
      node: databaseNode,
      field: address,
      value: "users",
    });
    expect(
      (await send("document-export", { kind: "state" })).workflow.steps[
        stepIndex
      ].config.collection,
    ).toBe("users");
    await send(
      "form-set",
      { node: databaseNode, field: address, value: "not-an-option" },
      "rejected",
    );
    await send(
      "form-options",
      { node: databaseNode, field: "root.outside.collection" },
      "rejected",
    );
  });
