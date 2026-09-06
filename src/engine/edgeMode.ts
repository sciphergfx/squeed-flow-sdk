import type { EdgeMode, FlowEdgeProperties } from "../types";

export function isPropertyEdge(edge: FlowEdgeProperties): boolean {
  return edge.sourceProperty !== undefined || edge.targetProperty !== undefined;
}

export function isEdgeVisible(
  edge: FlowEdgeProperties,
  mode: EdgeMode,
): boolean {
  return (
    mode === "auto" ||
    (mode === "properties" ? isPropertyEdge(edge) : !isPropertyEdge(edge))
  );
}

export function isNodeVisible(
  id: string,
  edges: readonly (FlowEdgeProperties & { source: string; target: string })[],
  mode: EdgeMode,
): boolean {
  return (
    mode !== "properties" ||
    id !== "root" ||
    edges.some(
      (edge) =>
        (edge.source === id || edge.target === id) && isPropertyEdge(edge),
    )
  );
}

export function visibleLayoutGraph<
  Node extends { id: string },
  Edge extends FlowEdgeProperties & { source: string; target: string },
>(
  nodes: Node[],
  edges: Edge[],
  mode: EdgeMode,
  compactPropertyLayout = false,
  isolatedIds?: ReadonlySet<string> | null,
) {
  if (!compactPropertyLayout || (mode !== "properties" && !isolatedIds))
    return { nodes, edges };
  const visibleNodes = nodes.filter(
    (node) =>
      isNodeVisible(node.id, edges, mode) &&
      (!isolatedIds || isolatedIds.has(node.id)),
  );
  const ids = new Set(visibleNodes.map((node) => node.id));
  return {
    nodes: visibleNodes,
    edges: edges.filter(
      (edge) =>
        isEdgeVisible(edge, mode) &&
        ids.has(edge.source) &&
        ids.has(edge.target),
    ),
  };
}
