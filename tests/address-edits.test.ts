import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addChild,
  addConnection,
  addTargetEdge,
  addressToPath,
  compileSqueed,
  getNode,
  removeEdge,
  removeNode,
  setCollapsed,
  setEdgeProp,
  setEdgeStyle,
  setNodeProp,
  updateNode,
  type SqueedJson,
} from "../src/core/squeedEdits";

function freezeDeep<Value>(value: Value): Value {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

test("addresses resolve root, nested leaves and compiler decorators", () => {
  const document = freezeDeep({
    backend: { runtime: "Node", enabled: false, empty: null },
    tags: ["beta"],
  });
  assert.equal(getNode(document, "root"), document);
  assert.deepEqual(addressToPath("root.backend.#.{3}"), ["backend"]);
  assert.equal(getNode(document, "root.backend.runtime"), "Node");
  assert.equal(getNode(document, "root.backend.enabled"), false);
  assert.equal(getNode(document, "root.backend.empty"), null);
  assert.equal(getNode(document, "root.backend.empty.child"), undefined);
  assert.equal(getNode(document, "root.tags.0"), "beta");
  assert.equal(getNode(document, "root.missing.child"), undefined);
});

test("updates copy only the addressed ancestors and allow root replacement", () => {
  const document = freezeDeep({
    backend: { runtime: "Node", config: { port: 3000 } },
    database: { engine: "Postgres" },
  });
  const next = updateNode(document, "root.backend.runtime", () => "Bun");
  assert.equal(getNode(next, "root.backend.runtime"), "Bun");
  assert.notEqual(next, document);
  assert.notEqual(next.backend, document.backend);
  assert.equal(next.backend.config, document.backend.config);
  assert.equal(next.database, document.database);
  assert.equal(document.backend.runtime, "Node");
  const replacement = { service: {} };
  assert.equal(
    updateNode(document, "root", () => replacement),
    replacement,
  );
  assert.deepEqual(
    updateNode(document, "root.missing.child", () => 1),
    document,
  );
});

for (const wrapped of [false, true]) {
  for (const initial of [[], [{ $label: "First" }, { $label: "Second" }]]) {
    test(`${wrapped ? "wrapped" : "plain"} ${initial.length ? "populated" : "empty"} array appends and removes at returned addresses`, () => {
      const list = structuredClone(initial);
      const document = freezeDeep({
        list: wrapped ? { $label: "List", $: list } : list,
        other: { stable: true },
      });
      const child = { $label: "Added" };
      const added = addChild(document, "root.list", child);
      assert.equal(added.address, `root.list.${initial.length}`);
      assert.equal(getNode(added.json, added.address), child);
      assert.deepEqual(wrapped ? added.json.list.$ : added.json.list, [
        ...initial,
        child,
      ]);
      assert.equal(added.json.other, document.other);
      const removed = removeNode(added.json, added.address);
      assert.deepEqual(removed, document);
      assert.equal(removed.other, document.other);
      if (initial.length) {
        const edited = updateNode(
          document,
          "root.list.0.$label",
          () => "Changed",
        );
        assert.equal(getNode(edited, "root.list.0.$label"), "Changed");
        assert.equal(
          getNode(edited, "root.list.1"),
          getNode(document, "root.list.1"),
        );
        assert.equal(getNode(document, "root.list.0.$label"), "First");
      }
    });
  }
}

test("root arrays remain arrays across edit, append and delete", () => {
  const document = freezeDeep(["one", "two"]);
  const edited = setNodeProp(document, "root.1", "$label", "second");
  assert.deepEqual(edited, ["one", "second"]);
  const added = addChild(edited, "root", "third");
  assert.equal(added.address, "root.2");
  assert.deepEqual(removeNode(added.json, "root.0"), ["second", "third"]);
  assert.equal(removeNode(document, "root"), document);
});

for (const wrapped of [false, true]) {
  test(`styling ${wrapped ? "wrapped" : "plain"} array leaves preserves node addresses and incoming mappings`, () => {
    const tags = ["beta", "stable"];
    const original = freezeDeep({
      tags: wrapped ? { $label: "Tags", $: tags } : tags,
      source: { $connections: [{ target: "root.tags.1" }] },
    });
    const initial = compileSqueed(original);
    let document = setNodeProp(
      original,
      "root.tags.1",
      "$bgColor",
      "transparent",
    );
    document = setNodeProp(document, "root.tags.1", "$textColor", "green.500");
    document = setNodeProp(document, "root.tags.1", "$icon", "PiTag");
    document = setNodeProp(document, "root.tags.1", "$label", "Edited tag");
    const graph = compileSqueed(document);
    assert.deepEqual(
      graph.nodes.map((node) => node.data.id),
      initial.nodes.map((node) => node.data.id),
    );
    assert.deepEqual(
      graph.edges.map((edge) => edge.data.id),
      initial.edges.map((edge) => edge.data.id),
    );
    const node = graph.nodes.find((node) => node.data.id === "root.tags.1")!;
    assert.equal(node.data.label, "Edited tag");
    assert.equal(node.data.viewProps.bgColor, "transparent");
    assert.equal(node.data.viewProps.textColor, "green.500");
    assert.equal(node.data.config?.icon, "PiTag");
    assert.deepEqual(getNode(document, node.data.id), {
      $label: "Edited tag",
      $bgColor: "transparent",
      $textColor: "green.500",
      $icon: "PiTag",
    });
  });
}

test("object children use explicit keys or unused generated keys", () => {
  const document = freezeDeep({
    parent: { node_1: { $label: "Existing" }, node_3: {} },
    sibling: {},
  });
  const added = addChild(document, "root.parent", { value: 2 });
  assert.equal(added.address, "root.parent.node_2");
  assert.equal(added.json.parent.node_1, document.parent.node_1);
  const named = addChild(added.json, "root.parent", { value: 4 }, "worker");
  assert.equal(named.address, "root.parent.worker");
  assert.deepEqual(getNode(named.json, named.address), { value: 4 });
  assert.deepEqual(removeNode(added.json, added.address), document);
});

test("removing absent paths is harmless and never deletes siblings", () => {
  const document = freezeDeep({
    parent: {},
    list: { $label: "Empty", $: [] },
    sibling: {},
  });
  for (const address of [
    "root.missing",
    "root.missing.child",
    "root.parent.missing",
    "root.list.5",
  ]) {
    assert.deepEqual(removeNode(document, address), document);
  }
});

test("node properties preserve false, remove resets, and wrap arrays without losing entries", () => {
  const document = freezeDeep({ node: { value: 0 }, tags: ["beta", "stable"] });
  const collapsed = setCollapsed(
    setCollapsed(document, "root.node", true),
    "root.node",
    false,
  );
  assert.equal(collapsed.node.$collapsed, false);
  for (const reset of [undefined, null, ""]) {
    const colored = setNodeProp(
      document,
      "root.node",
      "$bgColor",
      "transparent",
    );
    assert.equal(colored.node.$bgColor, "transparent");
    assert.deepEqual(
      setNodeProp(colored, "root.node", "$bgColor", reset),
      document,
    );
  }
  const wrapped = setNodeProp(document, "root.tags", "$bgColor", "teal.500");
  assert.deepEqual(wrapped.tags, {
    $bgColor: "teal.500",
    $: ["beta", "stable"],
  });
  assert.equal(getNode(wrapped, "root.tags.1"), "stable");
});

test("hierarchy, inverted hierarchy and target edge edits affect only their owners", () => {
  const document = freezeDeep({
    parent: { child: {} },
    source: {},
    target: {},
    sibling: {},
  });
  for (const edge of [
    { source: "root.parent", target: "root.parent.child" },
    { source: "root.parent.child", target: "root.parent", isInverted: true },
  ]) {
    const edited = setEdgeProp(document, edge, "$sourceLabel", "child link");
    assert.equal(edited.parent.child.$sourceLabel, "child link");
    assert.equal(edited.source, document.source);
    assert.deepEqual(removeEdge(edited, edge), {
      json: {
        ...edited,
        parent: {
          ...edited.parent,
          child: { ...edited.parent.child, $hideParentEdge: true },
        },
      },
      removed: true,
    });
  }
  const linked = addTargetEdge(document, "root.source", "root.target", "calls");
  const edge = { source: "root.source", target: "root.target" };
  const renamed = setEdgeProp(linked, edge, "$sourceLabel", "reads");
  assert.equal(renamed.source.$targetLabel, "reads");
  assert.equal(renamed.target, document.target);
  assert.deepEqual(removeEdge(renamed, edge), {
    json: document,
    removed: true,
  });
});

test("all edge styles round trip independently on property connections", () => {
  const original = freezeDeep({
    source: { output: "data", $target: "root.legacy" },
    target: { input: "data" },
    legacy: {},
  });
  let document: SqueedJson = addConnection(original, "root.source", {
    id: "mapping",
    sourceProperty: "output",
    target: "root.target",
    targetProperty: "input",
  });
  const edge = compileSqueed(document).edges.find(
    (edge) => edge.data.connection,
  )!.data;
  for (const style of ["animated", "dashed", "solid"] as const) {
    document = setEdgeStyle(document, edge, style);
    const rendered = compileSqueed(document).edges.find(
      (candidate) => candidate.data.id === edge.id,
    )!.data;
    assert.equal(rendered.isEdgeAnimated, style === "animated");
    assert.equal(rendered.isEdgeDashed, style === "dashed");
    assert.equal(document.source.$target, "root.legacy");
  }
  document = setEdgeProp(document, edge, "$edgeColor", "transparent");
  assert.equal(document.source.$connections[0].color, "transparent");
  document = setEdgeProp(document, edge, "$edgeColor", undefined);
  assert.equal(document.source.$connections[0].color, undefined);
  const removed = removeEdge(document, edge);
  assert.deepEqual(removed.json, original);
  assert.equal(removeEdge(removed.json, edge).removed, false);
});
