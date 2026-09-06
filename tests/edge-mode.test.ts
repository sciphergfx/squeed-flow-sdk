import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isEdgeVisible,
  isNodeVisible,
  isPropertyEdge,
  visibleLayoutGraph,
} from "../src/engine/edgeMode";
import { runDagreLayout } from "../src/engine/layout";

test("auto shows all edges while nodes and properties are exclusive visibility filters", () => {
  const nodeEdge = {};
  const propertyEdges = [
    { sourceProperty: "output" },
    { targetProperty: "input" },
    { sourceProperty: "output", targetProperty: "input" },
    { sourceProperty: "" },
  ];
  assert.equal(isPropertyEdge(nodeEdge), false);
  assert.equal(isEdgeVisible(nodeEdge, "auto"), true);
  assert.equal(isEdgeVisible(nodeEdge, "nodes"), true);
  assert.equal(isEdgeVisible(nodeEdge, "workflow"), true);
  assert.equal(isEdgeVisible(nodeEdge, "properties"), false);
  for (const edge of propertyEdges) {
    assert.equal(isPropertyEdge(edge), true);
    assert.equal(isEdgeVisible(edge, "auto"), true);
    assert.equal(isEdgeVisible(edge, "properties"), true);
    assert.equal(isEdgeVisible(edge, "nodes"), false);
    assert.equal(isEdgeVisible(edge, "workflow"), false);
  }
});

test("properties mode hides only the root without a property connection", () => {
  const hierarchy = [{ source: "root", target: "root.child" }];
  assert.equal(isNodeVisible("root", hierarchy, "properties"), false);
  assert.equal(isNodeVisible("root", [], "properties"), false);
  assert.equal(isNodeVisible("root.child", hierarchy, "properties"), true);
  assert.equal(isNodeVisible("unconnected", hierarchy, "properties"), true);
  for (const mode of ["auto", "nodes", "workflow"] as const)
    assert.equal(isNodeVisible("root", hierarchy, mode), true);
  for (const edge of [
    { source: "root", target: "root.child", sourceProperty: "value" },
    { source: "root.child", target: "root", targetProperty: "value" },
    { source: "root", target: "root.child", targetProperty: "" },
  ])
    assert.equal(isNodeVisible("root", [edge], "properties"), true);
});

test("property layout compaction is opt-in and removes invisible ranks without changing data", () => {
  const nodes = [
    { id: "root", width: 1500, height: 100 },
    { id: "alpha", width: 100, height: 100 },
    { id: "beta", width: 100, height: 100 },
  ];
  const edges = [
    { id: "hierarchy", source: "root", target: "alpha" },
    {
      id: "property",
      source: "alpha",
      target: "beta",
      sourceProperty: "value",
    },
    { id: "hidden-cycle", source: "beta", target: "alpha" },
  ];
  const original = structuredClone({ nodes, edges });
  const options = {
    rankDir: "LR" as const,
    rankSep: 150,
    edgeSep: 250,
    nodeSep: 5,
    spacingFactor: 1,
  };
  const normal = runDagreLayout(nodes, edges, options);
  for (const enabled of [undefined, false]) {
    const unchanged = visibleLayoutGraph(nodes, edges, "properties", enabled);
    assert.equal(unchanged.nodes, nodes);
    assert.equal(unchanged.edges, edges);
  }
  const properties = visibleLayoutGraph(nodes, edges, "properties", true);
  const compact = runDagreLayout(properties.nodes, properties.edges, options);
  assert.deepEqual(
    compact,
    runDagreLayout(nodes.slice(1), [edges[1]], options),
  );
  assert.equal(compact.has("root"), false);
  assert.ok(compact.get("alpha")!.x < normal.get("alpha")!.x);
  assert.deepEqual({ nodes, edges }, original);
  for (const mode of ["auto", "nodes", "workflow"] as const) {
    const restored = visibleLayoutGraph(nodes, edges, mode, true);
    assert.equal(restored.nodes, nodes);
    assert.equal(restored.edges, edges);
    assert.deepEqual(
      runDagreLayout(restored.nodes, restored.edges, options),
      normal,
    );
  }
});

test("opt-in compaction lays out only isolated nodes and rendered edges in every mode", () => {
  const nodes = ["root", "selected", "connected", "hidden"].map((id) => ({
    id,
  }));
  const edges = [
    { id: "node", source: "root", target: "selected" },
    {
      id: "property",
      source: "selected",
      target: "connected",
      sourceProperty: "value",
    },
    {
      id: "hidden",
      source: "hidden",
      target: "selected",
      targetProperty: "value",
    },
  ];
  const ids = new Set(["root", "selected", "connected"]);
  const auto = visibleLayoutGraph(nodes, edges, "auto", true, ids);
  assert.deepEqual(auto.nodes, nodes.slice(0, 3));
  assert.deepEqual(auto.edges, edges.slice(0, 2));
  const properties = visibleLayoutGraph(nodes, edges, "properties", true, ids);
  assert.deepEqual(properties.nodes, nodes.slice(1, 3));
  assert.deepEqual(properties.edges, [edges[1]]);
  assert.deepEqual(visibleLayoutGraph(nodes, edges, "nodes", true, ids).edges, [
    edges[0],
  ]);
  const disabled = visibleLayoutGraph(nodes, edges, "auto", false, ids);
  assert.equal(disabled.nodes, nodes);
  assert.equal(disabled.edges, edges);
  assert.equal(
    visibleLayoutGraph(nodes, edges, "auto", true, null).nodes,
    nodes,
  );
});
