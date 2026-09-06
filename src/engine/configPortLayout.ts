import { shapePort } from "./geometry";
import { surfaceBox, type NodeSurface } from "./nodeSurface";
import type { PropertyRow } from "./propertyRows";
import type { Box, PortSide } from "./types";
import type { FlowDirection } from "../types";

export function resolveConfigPortRows(
  rowsByNode: Map<string, PropertyRow[]>,
  boxes: Map<string, Box>,
  surfaces: Map<string, NodeSurface>,
  edges: readonly {
    source: string;
    target: string;
    sourceProperty?: string;
    targetProperty?: string;
  }[],
  direction: FlowDirection,
): Map<string, PropertyRow[]> {
  const horizontal = direction !== "TB" && direction !== "BT";
  const before: PortSide = horizontal ? "top" : "left";
  const after: PortSide = horizontal ? "bottom" : "right";
  const peers = new Map<string, Box[]>();
  for (const edge of edges) {
    for (const [id, property, peerId] of [
      [edge.source, edge.sourceProperty, edge.target],
      [edge.target, edge.targetProperty, edge.source],
    ]) {
      const box = boxes.get(peerId!);
      if (property === undefined || !box || peerId === id) continue;
      const surface = surfaces.get(peerId!);
      const key = JSON.stringify([id, property]);
      const group = peers.get(key) ?? [];
      group.push(surface ? surfaceBox(box, surface) : box);
      peers.set(key, group);
    }
  }
  const result = new Map(rowsByNode);
  for (const [id, rows] of rowsByNode) {
    const box = boxes.get(id);
    if (!box || !rows.some((row) => row.placement === "config")) continue;
    const surface = surfaces.get(id);
    const world = surface ? surfaceBox(box, surface) : box;
    const localHost = { x: box.w / 2, y: box.h / 2, w: box.w, h: box.h };
    const local = surface ? surfaceBox(localHost, surface) : localHost;
    const sides = new Map<PropertyRow, PortSide>();
    for (const row of rows) {
      if (row.placement !== "config") continue;
      const connected = peers.get(JSON.stringify([id, row.property])) ?? [];
      const offset = connected.reduce(
        (total, peer) =>
          total + (horizontal ? peer.y - world.y : peer.x - world.x),
        0,
      );
      const fallback = row.anchor?.side === after ? after : before;
      sides.set(
        row,
        offset < -0.001 ? before : offset > 0.001 ? after : fallback,
      );
    }
    result.set(
      id,
      rows.map((row) => {
        const side = sides.get(row);
        if (!side) return row;
        const siblings = rows.filter(
          (candidate) => sides.get(candidate) === side,
        );
        const position = (siblings.indexOf(row) + 1) / (siblings.length + 1);
        const anchor = shapePort(local, side, position);
        return { ...row, anchor, top: anchor.y, height: 0 };
      }),
    );
  }
  return result;
}
