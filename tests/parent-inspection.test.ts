import assert from "node:assert/strict";
import { test } from "node:test";
import { compileSqueed, getNode, removeEdge, resolveEdgeOwner, setCollapsed, setEdgeProp } from "../src/core/squeedEdits";
import { isEdgeVisible } from "../src/engine/edgeMode";

for (const nested of [false, true]) {
  test(`parent icon collapse retains ${nested ? "nested" : "referenced"} children and links`, () => {
    const children = {
      first: {
        $label: "First",
        $parent: "root.group",
        $target: "root.outside",
      },
      second: { $label: "Second", $parent: "root.group" },
    };
    const view = {
      group: { $label: "Group", $icon: "PiStack", ...(nested ? children : {}) },
      ...(nested ? {} : children),
      outside: { $label: "Outside" },
    };
    const expanded = compileSqueed(view);
    const collapsed = compileSqueed(setCollapsed(view, "root.group", true));
    const group = collapsed.nodes.find(
      (node) => node.data.id === "root.group",
    )!;
    assert.equal(group.data.type, "arrayView");
    assert.equal(group.data.config?.labelBelow, true);
    assert.equal(group.data.config?.parentContainer, true);
    assert.equal(
      collapsed.nodes.filter((node) => node.data.parent === "root.group")
        .length,
      0,
    );
    assert.ok(collapsed.nodes.some((node) => node.data.id === "root.outside"));
    const external = expanded.edges.find(
      (edge) => edge.data.source === (nested ? "root.group.first" : "root.first") && edge.data.target === "root.outside",
    )!;
    assert.ok(external);
    const collapsedExternal = collapsed.edges.find(
      (edge) => edge.data.id === external.data.id,
    );
    assert.equal(collapsedExternal?.data.source, "root.group");
    assert.equal(collapsedExternal?.data.target, "root.outside");
    assert.deepEqual(resolveEdgeOwner(collapsedExternal!.data), resolveEdgeOwner(external.data));
    const edited = setEdgeProp(view, collapsedExternal!.data, "$sourceLabel", "Updated");
    assert.equal(getNode(edited, external.data.source)?.$targetLabel, "Updated");
    const removed = removeEdge(view, collapsedExternal!.data);
    assert.equal(removed.removed, true);
    assert.equal(getNode(removed.json, external.data.source)?.$target, undefined);
    assert.equal(getNode(view, external.data.source)?.$target, "root.outside");
    assert.ok(collapsed.edges.every((edge) => edge.data.source !== edge.data.target));
    const restored = compileSqueed(
      setCollapsed(setCollapsed(view, "root.group", true), "root.group", false),
    );
    assert.deepEqual(
      restored.edges.map((edge) => edge.data.id),
      expanded.edges.map((edge) => edge.data.id),
    );
    assert.deepEqual(
      restored.nodes.map((node) => node.data.id),
      expanded.nodes.map((node) => node.data.id),
    );
  });
}

test("collapsed parents preserve incoming and outgoing property links but hide internal links", () => {
  const view = {
    $hideRoot: true,
    group: { $label: "Group" },
    first: { $parent: "root.group", value: 1, $connections: [
      { target: "root.outside", sourceProperty: "value", targetProperty: "input", label: "outgoing", color: "red.500", style: "animated" },
      { target: "root.second", sourceProperty: "value", targetProperty: "value", label: "internal" },
    ] },
    second: { $parent: "root.group", value: 2 },
    outside: { input: 0, $connections: [
      { target: "root.second", sourceProperty: "input", targetProperty: "value", label: "incoming" },
    ] },
  };
  const original = structuredClone(view);
  const expanded = compileSqueed(view);
  const document = setCollapsed(view, "root.group", true);
  const collapsed = compileSqueed(document);
  const links = collapsed.edges.filter(edge => edge.data.connection);
  assert.equal(links.length, 2);
  for (const link of links) {
    const before = expanded.edges.find(edge => edge.data.id === link.data.id)!;
    assert.ok(before);
    assert.deepEqual(link.data.connection, before.data.connection);
    assert.equal(link.data.sourceProperty, before.data.sourceProperty);
    assert.equal(link.data.targetProperty, before.data.targetProperty);
    assert.equal(isEdgeVisible(link.data, "properties"), true);
    if (link.data.label === "outgoing") {
      assert.equal(link.data.source, "root.group");
      assert.equal(link.data.target, "root.outside");
      assert.equal(link.data.color, "red.500");
      assert.equal(link.data.isEdgeAnimated, true);
      const edited = setEdgeProp(document, link.data, "$sourceLabel", "Updated");
      assert.equal(getNode(edited, "root.first")?.$connections[0].label, "Updated");
      assert.equal(getNode(removeEdge(document, link.data).json, "root.first")?.$connections.length, 1);
    } else {
      assert.equal(link.data.label, "incoming");
      assert.equal(link.data.source, "root.outside");
      assert.equal(link.data.target, "root.group");
    }
  }
  assert.deepEqual(compileSqueed(setCollapsed(document, "root.group", false)).edges, expanded.edges);
  assert.deepEqual(view, original);
});

test("nested collapsed parents route links to the outer visible icon", () => {
  const view = {
    $hideRoot: true,
    outer: { $label: "Outer", $collapsed: true },
    inner: { $label: "Inner", $parent: "root.outer", $collapsed: true },
    child: { $parent: "root.inner", $target: "root.outside" },
    outside: { $label: "Outside" },
  };
  const collapsed = compileSqueed(view);
  assert.deepEqual(collapsed.nodes.map(node => node.data.id).sort(), ["root.outer", "root.outside"]);
  const edge = collapsed.edges.find(edge => edge.data.target === "root.outside")!;
  assert.equal(edge.data.source, "root.outer");
  assert.deepEqual(resolveEdgeOwner(edge.data), { address: "root.child", kind: "target" });
  const expanded = compileSqueed(setCollapsed(view, "root.outer", false));
  assert.equal(expanded.edges.find(link => link.data.id === edge.data.id)?.data.source, "root.inner");
});
