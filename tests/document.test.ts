import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import {
  compileSqueed,
  setCollapsed,
  type SqueedJson,
} from "../src/core/squeedEdits";

test("batched document edits compose without dropping earlier changes", () => {
  const original = { alpha: { $label: "Alpha" }, beta: { $label: "Beta" } };
  let latest: SqueedJson = original;
  const callbacks = bindSqueedCallbacks(original, [], {}, (next) => {
    latest = next;
  });
  callbacks.onNodeColorChange!("root.alpha", "bg", "red.500");
  callbacks.onNodeColorChange!("root.beta", "bg", "red.500");
  assert.equal(latest.alpha.$bgColor, "red.500");
  assert.equal(latest.beta.$bgColor, "red.500");
  assert.deepEqual(original, {
    alpha: { $label: "Alpha" },
    beta: { $label: "Beta" },
  });
  callbacks.onNodeDelete!("root.alpha", {});
  callbacks.onNodeDelete!("root.beta", {});
  assert.deepEqual(latest, {});
});

test("creating nested nodes does not replace an existing child", () => {
  const original = { parent: { node_1: { $label: "Existing" } } };
  let latest: SqueedJson = original;
  const callbacks = bindSqueedCallbacks(original, [], {}, (next) => {
    latest = next;
  });
  callbacks.onNodeCreate!({
    type: "text",
    position: {},
    sourceNodeId: "root.parent",
  });
  callbacks.onNodeCreate!({
    type: "text",
    position: {},
    sourceNodeId: "root.parent",
  });
  assert.deepEqual(latest.parent.node_1, { $label: "Existing" });
  assert.deepEqual(latest.parent.node_2, {});
  assert.deepEqual(latest.parent.node_3, {});
});

test("edge editing updates and recompiles a cross-link", () => {
  const original = { alpha: { $target: "root.beta" }, beta: {} };
  const { edges } = compileSqueed(original);
  const edge = edges.find(
    (edge) =>
      edge.data.source === "root.alpha" && edge.data.target === "root.beta",
  )!;
  assert.ok(edge);
  let latest: SqueedJson = original;
  const callbacks = bindSqueedCallbacks(original, edges, {}, (next) => {
    latest = next;
  });
  callbacks.onEdgeLabelChange!(edge.data.id, "Calls");
  callbacks.onEdgeStyleChange!(edge.data.id, "animated");
  callbacks.onEdgeColorChange!(edge.data.id, "green.500");
  assert.equal(latest.alpha.$targetLabel, "Calls");
  const rendered = compileSqueed(latest).edges.find(
    (candidate) => candidate.data.id === edge.data.id,
  )!;
  assert.equal(rendered.data.label, "Calls");
  assert.equal(rendered.data.isEdgeAnimated, true);
  assert.equal(rendered.data.color, "green.500");
});

test("document collapse hides descendants, not cross-linked siblings", () => {
  const original = {
    alpha: { $collapsed: true, $target: "root.beta", child: {} },
    beta: {},
  };
  const collapsed = compileSqueed(original);
  assert.equal(
    collapsed.nodes.some((node) => node.data.id === "root.alpha.child"),
    false,
  );
  assert.equal(
    collapsed.nodes.some((node) => node.data.id === "root.beta"),
    true,
  );
  const expanded = compileSqueed(setCollapsed(original, "root.alpha", false));
  assert.equal(
    expanded.nodes.some((node) => node.data.id === "root.alpha.child"),
    true,
  );
  assert.equal(
    expanded.nodes.find((node) => node.data.id === "root.alpha")?.data.config
      ?.collapsed,
    false,
  );
});
