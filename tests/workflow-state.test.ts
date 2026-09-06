import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readFormSchema } from "../src/core/forms";
import { compileSqueed } from "../src/core/squeedEdits";
import { resolveStateView } from "../src/utils/formState";
import {
  projectWorkflowStateView,
  removeWorkflowResourceReference,
  resolveExampleOptions,
} from "../examples/workflow-state/callbacks";

test("separate workflow example compiles and loads its bound interfaces", async () => {
  const read = (name: string) =>
    JSON.parse(readFileSync(`examples/workflow-state/${name}.json`, "utf8"));
  const state = read("state");
  const view = read("view");
  const bindings = read("bindings");
  const source = readFileSync("examples/workflow-state/interface.ts", "utf8");
  const schema = await readFormSchema(
    { name: "interface.ts", size: source.length, text: async () => source },
    Object.values(bindings).map((binding: any) => binding.type),
  );
  assert.equal(Object.keys(schema).length, 8);
  assert.equal(schema.TextConfig.properties.content.type.kind, "string");
  const projected = projectWorkflowStateView(view, state);
  const compiled = compileSqueed(resolveStateView(projected, state));
  for (const address of Object.keys(bindings))
    assert.ok(
      compiled.nodes.some((node) => node.data.id === address),
      address,
    );
  assert.ok(
    compiled.edges.some(
      (edge) =>
        edge.data.source === "root.decision" &&
        edge.data.target === "root.addChannel",
    ),
  );
  assert.equal(JSON.stringify(state).includes('"$'), false);
  assert.equal(JSON.stringify(view).includes('"$form"'), false);
  assert.deepEqual(state.steps[0].config.tools, [
    "directory_lookup",
    "issue_lookup",
  ]);
  assert.equal(state.steps[0].config.promptId, "user_review");
  assert.equal(state.steps[0].config.prompt, undefined);
  assert.equal(
    bindings["root.directoryTool"].address,
    "root.tools.directory_lookup",
  );
  assert.equal(view.prompt.$content.$state, "root.texts.user_review.content");
  assert.ok(
    compiled.edges.some(
      (edge) =>
        edge.data.source === "root.assistant" &&
        edge.data.target === "root.directoryTool",
    ),
  );
  assert.ok(
    compiled.edges.some(
      (edge) =>
        edge.data.source === "root.assistant" &&
        edge.data.target === "root.prompt",
    ),
  );
  const shared = structuredClone(state);
  for (const target of ["root.model", "root.knowledgeMemory"])
    assert.ok(
      compiled.edges.some(
        (edge) =>
          edge.data.source === "root.assistant" && edge.data.target === target,
      ),
    );
  shared.models["example-model"].name = "Shared Model";
  assert.deepEqual(
    resolveExampleOptions({
      address: "root.steps.0.config.model",
      nodeAddress: "root.assistant",
      data: shared,
      signal: new AbortController().signal,
    }),
    [{ label: "Shared Model", value: "example-model" }],
  );
  shared.steps[1].config.tools = ["directory_lookup"];
  const reused = compileSqueed(
    resolveStateView(projectWorkflowStateView(view, shared), shared),
  );
  assert.equal(
    reused.nodes.filter((node) => node.data.id === "root.directoryTool").length,
    1,
  );
  assert.equal(
    reused.edges.filter(
      (edge) =>
        edge.data.target === "root.directoryTool" &&
        edge.data.source !== "root",
    ).length,
    2,
  );
  shared.steps[0].config.tools = [];
  const changed = compileSqueed(
    resolveStateView(projectWorkflowStateView(projected, shared), shared),
  );
  assert.equal(
    changed.edges.filter(
      (edge) =>
        edge.data.source === "root.assistant" &&
        edge.data.target === "root.directoryTool",
    ).length,
    0,
  );
  assert.equal(
    changed.nodes.filter((node) => node.data.id === "root.directoryTool")
      .length,
    1,
  );
  shared.tools.directory_lookup.name = "Shared Directory";
  assert.deepEqual(
    resolveExampleOptions({
      address: "root.steps.0.config.tools",
      nodeAddress: "root.assistant",
      data: shared,
      signal: new AbortController().signal,
    })[0],
    { label: "Shared Directory", value: "directory_lookup" },
  );
});

test("deleting resource attachments clears only the matching step reference", () => {
  const state = JSON.parse(
    readFileSync("examples/workflow-state/state.json", "utf8"),
  );
  const view = JSON.parse(
    readFileSync("examples/workflow-state/view.json", "utf8"),
  );
  state.steps[1].config.tools = ["directory_lookup"];
  const original = JSON.stringify(state);
  const projected = projectWorkflowStateView(view, state);
  const graph = compileSqueed(resolveStateView(projected, state));
  const attachments = graph.edges.filter(
    (edge) =>
      edge.data.source === "root.assistant" &&
      edge.data.sourceProperty?.startsWith("resource:"),
  );
  assert.equal(attachments.length, 6);
  for (const { data } of attachments) {
    const next = removeWorkflowResourceReference(state, data);
    assert.notEqual(next, state);
    assert.equal(JSON.stringify(state), original);
    for (const collection of ["tools", "texts", "models", "memorySources"])
      assert.equal(next[collection], state[collection]);
    assert.equal(next.steps[1], state.steps[1]);
    const reprojected = compileSqueed(
      resolveStateView(projectWorkflowStateView(projected, next), next),
    );
    assert.equal(
      reprojected.edges.some(
        (edge) =>
          edge.data.source === data.source &&
          edge.data.sourceProperty === data.sourceProperty,
      ),
      false,
    );
    assert.ok(reprojected.nodes.some((node) => node.data.id === data.target));
    assert.equal(
      reprojected.edges.filter(
        (edge) =>
          edge.data.source === "root.assistant" &&
          edge.data.sourceProperty?.startsWith("resource:"),
      ).length,
      5,
    );
    assert.equal(removeWorkflowResourceReference(next, data), next);
  }
  assert.equal(
    removeWorkflowResourceReference(state, {
      source: "root.assistant",
      target: "root.prompt",
    }),
    state,
  );
  assert.equal(
    removeWorkflowResourceReference(state, {
      source: "root.assistant",
      target: "root.issueTool",
      sourceProperty: "resource:tools:directory_lookup",
    }),
    state,
  );
});

test("legacy generated resource ports follow flow direction without changing references", () => {
  const state = JSON.parse(
    readFileSync("examples/workflow-state/state.json", "utf8"),
  );
  const view = JSON.parse(
    readFileSync("examples/workflow-state/view.json", "utf8"),
  );
  const original = JSON.stringify(state);
  let current = view;
  for (const [direction, sourceSide, targetSide] of [
    ["LR", "right", "left"],
    ["RL", "left", "right"],
    ["TB", "bottom", "top"],
    ["BT", "top", "bottom"],
    ["C", "right", "left"],
  ] as const) {
    current = projectWorkflowStateView(current, state, direction);
    for (const port of current.assistant.$ports)
      assert.equal(port.side, sourceSide);
    for (const connection of current.assistant.$connections) {
      if (!connection.id?.startsWith("resource:")) continue;
      const target = connection.target.slice("root.".length);
      assert.equal(current[target].$ports[0].side, targetSide);
      assert.equal(connection.id, connection.sourceProperty);
    }
  }
  assert.equal(JSON.stringify(state), original);
  assert.equal(view.assistant.$ports, undefined);
});

test("trigger subtitles resolve event, schedule and mode without changing the view", () => {
  const view = JSON.parse(
    readFileSync("examples/workflow-state/view.json", "utf8"),
  );
  const original = JSON.stringify(view);
  for (const [trigger, subtitle] of [
    [{ type: "event", event: "user.created" }, "user.created"],
    [{ type: "event", event: "user.updated" }, "user.updated"],
    [{ type: "event" }, "event"],
    [{ type: "manual", event: "user.created" }, "manual"],
    [{ type: "schedule", cron: "0 9 * * 1-5" }, "0 9 * * 1-5"],
    [{ type: "schedule" }, "schedule"],
  ] as const) {
    const state = { trigger };
    const display = resolveStateView(
      projectWorkflowStateView(view, state),
      state,
    );
    const compiled = compileSqueed(display);
    assert.equal(
      compiled.nodes.find((node) => node.data.id === "root.trigger")?.data
        .config?.subtitle,
      subtitle,
    );
    assert.equal(JSON.stringify(view), original);
  }
});

test("resource links preserve edge customizations and resets across view updates", () => {
  const state = JSON.parse(
    readFileSync("examples/workflow-state/state.json", "utf8"),
  );
  const view = JSON.parse(
    readFileSync("examples/workflow-state/view.json", "utf8"),
  );
  const projected = projectWorkflowStateView(view, state);
  const portId = "resource:promptId:user_review";
  for (const style of ["animated", "solid", "dashed"]) {
    const edited = structuredClone(projected);
    const connection = edited.assistant.$connections.find(
      (entry: { id: string }) => entry.id === portId,
    );
    Object.assign(connection, {
      style,
      label: "Shared prompt",
      color: "teal.500",
      icon: "PiLink",
      type: "bezier",
    });
    const original = JSON.stringify(edited);
    const nextState = structuredClone(state);
    nextState.trigger.type = "manual";
    const next = projectWorkflowStateView(edited, nextState);
    assert.deepEqual(
      next.assistant.$connections.find(
        (entry: { id: string }) => entry.id === portId,
      ),
      connection,
    );
    const compiled = compileSqueed(resolveStateView(next, nextState));
    const edge = compiled.edges.find(
      (edge) =>
        edge.data.source === "root.assistant" &&
        edge.data.target === "root.prompt",
    )!.data;
    assert.equal(edge.isEdgeAnimated, style === "animated");
    assert.equal(edge.isEdgeDashed, style === "dashed");
    assert.equal(edge.color, "teal.500");
    assert.equal(edge.label, "Shared prompt");
    assert.equal(edge.icon, "PiLink");
    assert.equal(edge.type, "bezier");
    assert.equal(JSON.stringify(edited), original);
    delete connection.label;
    delete connection.color;
    delete connection.icon;
    delete connection.type;
    const reset = projectWorkflowStateView(
      edited,
      nextState,
    ).assistant.$connections.find(
      (entry: { id: string }) => entry.id === portId,
    );
    assert.deepEqual(reset, connection);
  }
});
