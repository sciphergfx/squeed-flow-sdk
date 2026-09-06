import type { FlowDiagramEdge, FlowDiagramNode } from "../types";
import { getNode, type SqueedJson } from "./squeedEdits";

type Graph = { nodes: FlowDiagramNode[]; edges: FlowDiagramEdge[] };

export function applyParentGroups(json: SqueedJson, graph: Graph): Graph {
  const groupIds = new Set<string>();
  const collect = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.$parent === "string") groupIds.add(value.$parent);
    for (const [key, child] of Object.entries(value))
      if (!key.startsWith("$") || key === "$") collect(child);
  };
  collect(json);
  if (!groupIds.size) return graph;
  const byId = new Map(graph.nodes.map((node) => [node.data.id, node]));
  const visibleEndpoint = (node: FlowDiagramNode) => {
    let endpoint = node.data.id;
    const seen = new Set<string>([node.data.id]);
    let parent = node.data.parent;
    while (parent && !seen.has(parent)) {
      if (groupIds.has(parent) && byId.has(parent) && getNode(json, parent)?.$collapsed)
        endpoint = parent;
      seen.add(parent);
      parent = byId.get(parent)?.data.parent;
    }
    return endpoint;
  };
  const endpoints = new Map(graph.nodes.map(node => [node.data.id, visibleEndpoint(node)]));
  const nodes = graph.nodes
    .filter((node) => endpoints.get(node.data.id) === node.data.id)
    .map((node) => {
      if (!groupIds.has(node.data.id)) return node;
      const source = getNode(json, node.data.id);
      const collapsed = !!source?.$collapsed;
      return {
        ...node,
        data: {
          ...node.data,
          ...(collapsed ? { type: "arrayView" } : {}),
          config: {
            ...node.data.config,
            parentContainer: true,
            collapsed,
            ...(collapsed
              ? { labelBelow: true, icon: source?.$icon || "PiStack" }
              : {}),
          },
        },
      };
    });
  const ids = new Set(nodes.map((node) => node.data.id));
  return {
    nodes,
    edges: graph.edges.flatMap(edge => {
      const source = endpoints.get(edge.data.source);
      const target = endpoints.get(edge.data.target);
      if (!source || !target || !ids.has(source) || !ids.has(target)) return [];
      if (source === edge.data.source && target === edge.data.target) return [edge];
      if (source === target) return [];
      return [{
        ...edge,
        data: {
          ...edge.data,
          source,
          target,
          collapsedEndpoints: edge.data.collapsedEndpoints ?? {
            source: edge.data.source,
            target: edge.data.target,
          },
        },
      }];
    }),
  };
}
