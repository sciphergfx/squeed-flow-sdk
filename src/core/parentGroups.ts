import type { FlowDiagramEdge, FlowDiagramNode } from "../types";
import { getNode, type SqueedJson } from "./squeedEdits";

type Graph = { nodes: FlowDiagramNode[]; edges: FlowDiagramEdge[] };

export function applyParentGroups(json: SqueedJson, graph: Graph): Graph {
  const groupIds = new Set<string>();
  const collect = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.$parent === "string") groupIds.add(value.$parent);
    for (const [key, child] of Object.entries(value)) if (!key.startsWith("$") || key === "$") collect(child);
  };
  collect(json);
  if (!groupIds.size) return graph;
  const byId = new Map(graph.nodes.map(node => [node.data.id, node]));
  const hidden = (node: FlowDiagramNode) => {
    const seen = new Set<string>([node.data.id]);
    let parent = node.data.parent;
    while (parent && !seen.has(parent)) {
      if (getNode(json, parent)?.$collapsed) return true;
      seen.add(parent);
      parent = byId.get(parent)?.data.parent;
    }
    return false;
  };
  const nodes = graph.nodes.filter(node => !hidden(node)).map(node => {
    if (!groupIds.has(node.data.id)) return node;
    const source = getNode(json, node.data.id);
    const collapsed = !!source?.$collapsed;
    return { ...node, data: { ...node.data,
      ...(collapsed ? { type: "arrayView" } : {}),
      config: { ...node.data.config, parentContainer: true, collapsed,
        ...(collapsed ? { labelBelow: true, icon: source?.$icon || "PiStack" } : {}),
      },
    } };
  });
  const ids = new Set(nodes.map(node => node.data.id));
  return { nodes, edges: graph.edges.filter(edge => ids.has(edge.data.source) && ids.has(edge.data.target)) };
}