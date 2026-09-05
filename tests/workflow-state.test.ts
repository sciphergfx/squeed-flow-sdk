import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readFormSchema } from "../src/core/forms";
import { compileSqueed } from "../src/core/squeedEdits";
import { resolveStateView } from "../src/utils/formState";
import {
  projectWorkflowStateView,
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
  assert.equal(Object.keys(schema).length, 5);
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
