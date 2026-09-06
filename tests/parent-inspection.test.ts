import assert from "node:assert/strict";
import { test } from "node:test";
import { compileSqueed, setCollapsed } from "../src/core/squeedEdits";

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
