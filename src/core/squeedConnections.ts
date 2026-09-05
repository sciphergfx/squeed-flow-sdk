import type { FlowDiagramEdge, SqueedConnection } from "../types";
import type { SqueedJson } from "./squeedEdits";

export function connectionEntries(
  node: any,
): { value: SqueedConnection; key: string; index: number }[] {
  if (!Array.isArray(node?.$connections)) return [];
  const seen = new Map<string, number>();
  return node.$connections.flatMap((value: unknown, index: number) => {
    if (!value || typeof value !== "object") return [];
    const connection = value as SqueedConnection;
    if (
      typeof connection.target !== "string" ||
      !/^root(?:\.|$)/.test(connection.target)
    )
      return [];
    if (
      connection.sourceProperty !== undefined &&
      typeof connection.sourceProperty !== "string"
    )
      return [];
    if (
      connection.targetProperty !== undefined &&
      typeof connection.targetProperty !== "string"
    )
      return [];
    const identity =
      typeof connection.id === "string" && connection.id
        ? JSON.stringify(["id", connection.id])
        : JSON.stringify([
            "ports",
            connection.target,
            connection.sourceProperty ?? null,
            connection.targetProperty ?? null,
          ]);
    const occurrence = seen.get(identity) ?? 0;
    seen.set(identity, occurrence + 1);
    return [{ value: connection, key: `${identity}#${occurrence}`, index }];
  });
}

export function updateConnection(
  node: any,
  key: string,
  update: (value: SqueedConnection) => SqueedConnection | null,
) {
  const entry = connectionEntries(node).find((entry) => entry.key === key);
  if (!entry) return node;
  const value = update(entry.value);
  const connections = node.$connections.flatMap(
    (current: unknown, index: number) =>
      index === entry.index ? (value ? [value] : []) : [current],
  );
  if (connections.length) return { ...node, $connections: connections };
  const { $connections: removed, ...rest } = node;
  return rest;
}

export function prepareConnections(document: SqueedJson): {
  json: SqueedJson;
  edges: FlowDiagramEdge[];
} {
  const edges: FlowDiagramEdge[] = [];
  const visit = (value: any, address: string): any => {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value))
      return value.map((child, index) => visit(child, `${address}.${index}`));
    for (const entry of connectionEntries(value)) {
      const connection = entry.value;
      edges.push({
        data: {
          id: `connection:${JSON.stringify([address, entry.key])}`,
          source: address,
          target: connection.target,
          type:
            typeof connection.type === "string" ? connection.type : undefined,
          sourceProperty: connection.sourceProperty,
          targetProperty: connection.targetProperty,
          icon: typeof connection.icon === "string" ? connection.icon : undefined,
          label:
            typeof connection.label === "string" ? connection.label : undefined,
          color:
            typeof connection.color === "string" ? connection.color : undefined,
          isEdgeDashed: connection.style === "dashed",
          isEdgeAnimated: connection.style === "animated",
          connection: { address, key: entry.key },
        },
      });
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "$connections")
        .map(([key, child]) => [
          key,
          key === "$"
            ? visit(child, address)
            : key.startsWith("$")
              ? child
              : visit(child, `${address}.${key}`),
        ]),
    );
  };
  return { json: visit(document, "root"), edges };
}
