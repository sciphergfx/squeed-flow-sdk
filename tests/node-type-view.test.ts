import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import { compileSqueed, type SqueedJson } from "../src/core/squeedEdits";
import { NODE_TYPE_VIEWS } from "../src/types";
import { nodeContentCallbacks } from "../../../backflow/backflow-admin/src/pages/sdk-test/nodeContentCallbacks";
import type { FlowDiagramNode, FlowDiagramEdge } from "../src/types";

test("type view reuses $view and None removes only the override", () => {
  const original = {
    task: {
      $label: "Task",
      $icon: "PiGear",
      $content: "Details",
      $form: { $type: "Task" },
      value: 4,
      $connections: [{ target: "root.next", sourceProperty: "value" }],
    },
    next: {},
  };
  let current: SqueedJson = original;
  const notices: unknown[] = [];
  const callbacks = bindSqueedCallbacks(
    original,
    [],
    { onNodeTypeViewChange: (id, view) => notices.push([id, view]) },
    (next) => {
      current = next;
    },
  );
  const edges = compileSqueed(original).edges;
  for (const view of NODE_TYPE_VIEWS.slice(1)) {
    callbacks.onNodeTypeViewChange!("root.task", view || undefined);
    assert.deepEqual(current, {
      ...original,
      task: { ...original.task, $view: view },
    });
    assert.deepEqual(compileSqueed(current).edges, edges);
  }
  callbacks.onNodeTypeViewChange!("root.task", undefined);
  assert.deepEqual(current, original);
  assert.equal(Object.hasOwn(current.task, "$view"), false);
  assert.equal(notices.length, 4);
});

test("type view batch edits compose and unknown visual types are ignored", () => {
  let current: SqueedJson = { first: {}, second: {} };
  const callbacks = bindSqueedCallbacks(current, [], {}, (next) => {
    current = next;
  });
  callbacks.onNodeTypeViewChange!("root.first", "text");
  callbacks.onNodeTypeViewChange!("root.second", "object");
  callbacks.onNodeTypeViewChange!("root.second", "http" as never);
  assert.deepEqual(current, {
    first: { $view: "text" },
    second: { $view: "object" },
  });
});

test("raw view overrides retain the original renderer, properties and connections", () => {
  const original: { nodes: FlowDiagramNode[]; edges: FlowDiagramEdge[] } = {
    nodes: [
      {
        data: {
          id: "task",
          type: "objectView",
          label: "Task",
          description: { status: "Ready" },
          config: { icon: "PiGear", labelBelow: true },
        },
      },
    ],
    edges: [{ data: { id: "link", source: "task", target: "next" } }],
  };
  let graph = original;
  const callbacks = nodeContentCallbacks(
    false,
    (change) => {
      graph = change(graph);
    },
    () => {},
  );
  for (const view of ["text", "object", "icon-label"] as const) {
    callbacks.onNodeTypeViewChange("task", view);
    assert.equal(graph.nodes[0].data.type, "objectView");
    assert.equal(graph.nodes[0].data.config?.typeView, view);
    assert.equal(
      graph.nodes[0].data.description,
      original.nodes[0].data.description,
    );
    assert.equal(graph.edges, original.edges);
  }
  callbacks.onNodeTypeViewChange("task", undefined);
  assert.deepEqual(graph, original);
});
