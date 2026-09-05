import type { FlowDiagramNode, FlowDiagramEdge } from "../types";
import { getNode, type SqueedJson } from "./squeedEdits";

type Graph = { nodes: FlowDiagramNode[]; edges: FlowDiagramEdge[] };
const colors = {
  $bgColor: "bgColor",
  $textColor: "textColor",
  $borderColor: "borderColor",
} as const;

export function recolorGraph(
  previous: SqueedJson,
  next: SqueedJson,
  graph: Graph,
): Graph | undefined {
  if (previous === next) return graph;
  const changed = new Map<string, Record<string, string>>();
  const compare = (before: any, after: any, address: string): boolean => {
    if (before === after) return true;
    if (
      !before ||
      !after ||
      typeof before !== "object" ||
      typeof after !== "object" ||
      Array.isArray(before) !== Array.isArray(after)
    )
      return false;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (Object.is(before[key], after[key])) continue;
      if (Object.prototype.hasOwnProperty.call(colors, key)) {
        if (typeof after[key] !== "string" || !after[key]) return false;
        changed.set(address, {
          ...changed.get(address),
          [colors[key]]: after[key],
        });
      } else if (
        (key.startsWith("$") && key !== "$") ||
        !compare(
          before[key],
          after[key],
          key === "$" ? address : `${address}.${key}`,
        )
      )
        return false;
    }
    return true;
  };
  if (!compare(previous, next, "root")) return undefined;
  const ids = new Set(graph.nodes.map((node) => node.data.id));
  for (const address of changed.keys()) {
    if (!ids.has(address) || !getNode(next, address)) return undefined;
  }
  return {
    edges: graph.edges,
    nodes: graph.nodes.map((node) => {
      const style = changed.get(node.data.id);
      const before = getNode(previous, node.data.id);
      const after = getNode(next, node.data.id);
      if (!style && before === after) return node;
      return {
        ...node,
        data: {
          ...node.data,
          ...(typeof node.data.code === "string"
            ? { code: JSON.stringify(after, null, 2) }
            : {}),
          ...(style ? { viewProps: { ...node.data.viewProps, ...style }, config: { ...node.data.config, ...style } } : {}),
        },
      };
    }),
  };
}
