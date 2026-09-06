import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { FLOW_COMMANDS } from "../examples/mcp/commands";
import { createSqueedProvision } from "../examples/mcp/provision";
import {
  parseSDKCommand,
  dispatchSDKCommand,
  type CommandContext,
} from "../../../backflow/backflow-admin/src/pages/sdk-test/mcpCommands";
import { createSDKCommandHost } from "../../../backflow/backflow-admin/src/pages/sdk-test/sdkCommandHost";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";

const input = { executionId: "demo", node: "task", label: "New label" };
const event = (payload: unknown, command = "node-label") => ({
  type: "mcp_sdk_command",
  data: { executionId: "demo", command, payload },
});
const context = (): CommandContext => ({
  diagram: { callbacks: {}, config: {}, engineRef: { current: null } } as any,
  nodeById: new Map([
    ["root.task", { data: { id: "root.task", type: "objectView" } }],
  ]),
  edgeById: new Map(),
  nodes: { task: "root.task" },
  host: {},
});

test("commands reject malformed, unscoped, unknown and prototype-bearing input", () => {
  assert.equal(parseSDKCommand(event(input), "other"), undefined);
  assert.equal(
    parseSDKCommand({ ...event(input), executionId: "other" }, "demo"),
    undefined,
  );
  assert.ok(parseSDKCommand(event(input), "demo"));
  for (const invalid of [
    null,
    [],
    {},
    { ...input, executionId: "other" },
    { ...input, label: 2 },
    { ...input, extra: true },
  ])
    assert.throws(() => parseSDKCommand(event(invalid), "demo"));
  assert.throws(() => parseSDKCommand(event(input, "onInit"), "demo"));
  assert.throws(() =>
    parseSDKCommand(
      event(
        { executionId: "demo", document: JSON.parse('{"__proto__":{}}') },
        "document-replace",
      ),
      "demo",
    ),
  );
});

test("optional route placeholders are omitted without coercing required command values", () => {
  const command = parseSDKCommand(
    event(
      { executionId: "demo", requestId: "", padding: "", animate: "" },
      "fit",
    ),
    "demo",
  )!;
  assert.deepEqual(command.input, { executionId: "demo" });
  assert.throws(() =>
    parseSDKCommand(
      event({ executionId: "demo", zoom: "0.5" }, "zoom"),
      "demo",
    ),
  );
  assert.equal(
    parseSDKCommand(event({ ...input, label: "" }), "demo")!.input.label,
    "",
  );
});

test("dispatch resolves existing aliases, supports reset and guards read-only", async () => {
  const state = context();
  const calls: unknown[][] = [];
  state.diagram.callbacks.onNodeBorderWidthChange = (...args) => {
    calls.push(args);
  };
  const command = parseSDKCommand(
    event(
      { executionId: "demo", node: "task", width: null },
      "node-border-width",
    ),
    "demo",
  )!;
  await dispatchSDKCommand(command, state);
  assert.deepEqual(calls, [["root.task", undefined]]);
  await assert.rejects(
    dispatchSDKCommand(
      { ...command, input: { ...command.input, node: "missing" } },
      state,
    ),
  );
  state.diagram.readOnly = true;
  await assert.rejects(dispatchSDKCommand(command, state));
  assert.equal(calls.length, 1);
});

test("dispatch uses the SDK document binding rather than mutating renderer data", async () => {
  const state = context();
  let document: any = { task: { name: "task" } };
  state.diagram.callbacks = bindSqueedCallbacks(document, [], {}, (next) => {
    document = next;
  });
  await dispatchSDKCommand(parseSDKCommand(event(input), "demo")!, state);
  assert.equal(document.task.$label, "New label");
  assert.equal(state.nodeById.get("root.task")!.data.label, undefined);
});

test("every catalog binding resolves to an existing SDK or implemented host method", () => {
  const methods = (file: string, name: string) => {
    const parsed = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const declaration = parsed.statements.find(
      (statement) =>
        ts.isInterfaceDeclaration(statement) && statement.name.text === name,
    ) as ts.InterfaceDeclaration;
    assert.ok(declaration, name);
    return new Set(
      declaration.members.map((member) => member.name?.getText(parsed)),
    );
  };
  const sdk = {
    callback: methods("src/types/index.ts", "FlowDiagramCallbacks"),
    context: methods(
      "src/components/FlowDiagramContext.tsx",
      "FlowDiagramContextValue",
    ),
    engine: methods("src/engine/types.ts", "FlowEngine"),
  };
  const host = createSDKCommandHost(context(), { callbacks: {} }, {});
  const suppliedBySDKTest = [
    "replaceJson",
    "replaceState",
    "exportDocument",
    "exportConfiguration",
    "replaceConfiguration",
    "setColorMode",
    "setNodeAlignment",
    "exportSvg",
  ];
  const hostSource = readFileSync(
    "../../backflow/backflow-admin/src/pages/SDKTest.tsx",
    "utf8",
  );
  for (const command of FLOW_COMMANDS) {
    if (command.handler !== "host")
      assert.ok(sdk[command.handler].has(command.method), command.name);
    else if (!Object.hasOwn(host, command.method)) {
      assert.ok(suppliedBySDKTest.includes(command.method), command.name);
      assert.ok(hostSource.includes(`${command.method}:`), command.name);
    }
  }
  const represented = new Set(FLOW_COMMANDS.map((command) => command.method));
  const indirect = [
    "onNodeCreate",
    "onNodeDelete",
    "onNodeSelect",
    "onNodeDeselect",
    "onEdgeCreate",
    "onEdgeDelete",
    "onEdgeSelect",
    "onEdgeDeselect",
    "onFormChange",
    "onFormSchemaChange",
    "resolveFormOptions",
    "onNodeViewModeChange",
    "onThemeColorChange",
    "onEdgeModeChange",
    "onEdgeRadiusChange",
    "onSpacingChange",
    "onBackgroundVariantChange",
    "onCompactPropertyLayoutChange",
    "onWorkflowContractChange",
    "onArrayModeChange",
  ];
  const notifications = [
    "onNodeCreateRequest",
    "onBackgroundClick",
    "onNodeDoubleClick",
    "onNodeViewToggle",
    "onNodeHoverAction",
    "onEdgeRemove",
    "onViewportChange",
    "onInit",
    "onLayoutComplete",
    "onJsonChange",
  ];
  for (const method of sdk.callback)
    assert.ok(
      represented.has(method!) ||
        indirect.includes(method!) ||
        notifications.includes(method!),
      `Unmapped callback: ${method}`,
    );
});

test("generated routes share the publish workflow and have MCP-compatible field schemas", () => {
  const manifest = createSqueedProvision();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        "../../backflow/backflow-video/.backflow/squeed/provision.json",
        "utf8",
      ),
    ),
    manifest,
  );
  assert.equal(manifest.routes.length, FLOW_COMMANDS.length);
  assert.equal(manifest.workflows.length, 3);
  for (const route of manifest.routes) {
    assert.equal(route.requireAuth, true);
    assert.equal(route.mcpEnabled, true);
    assert.equal(route.cache.enabled, false);
    assert.ok(route.request.body.executionId);
    assert.ok(
      manifest.workflows.some(
        (workflow) => workflow.id === route.integrations.actions[0].workflowId,
      ),
    );
  }
});
