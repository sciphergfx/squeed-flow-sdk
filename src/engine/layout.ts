import dagre from "dagre";
import type { NodeAlignment } from "../types";
import { LABEL_MARGIN_X, measureEdgeLabel } from "./edgeLabel";
import type { Point, Rect } from "./types";

export interface LayoutNodeInput {
  id: string;
  parent?: string;
  width: number;
  height: number;
  hasBody?: boolean;
}

export interface LayoutEdgeInput {
  id: string;
  source: string;
  target: string;
  connectorClearance?: number;
  label?: string;
  icon?: string;
  data?: { icon?: string };
}

export interface LayoutOptions {
  edgeLabelFontSize?: number;
  rankDir: "LR" | "RL" | "TB" | "BT";
  compact?: boolean;
  compactSpacingScale?: number;
  nodeAlignment?: NodeAlignment;
  rankSep: number;
  edgeSep: number;
  nodeSep: number;
  /** cytoscape `spacingFactor`: scales positions about the centre of their bounding box */
  spacingFactor: number;
}

/**
 * Port of cytoscape-dagre: compound parents are passed with `setParent`, edges touching a
 * compound node are skipped (dagre can't rank them), only leaf nodes receive positions.
 */
export function runDagreLayout(
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  opts: LayoutOptions,
): Map<string, Point> {
  const ids = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parents = new Set<string>();
  for (const n of nodes)
    if (n.parent && ids.has(n.parent)) parents.add(n.parent);
  const bodyIds = new Map<string, string>();
  for (const node of nodes) {
    if (!node.hasBody || !parents.has(node.id)) continue;
    let bodyId = `${node.id}.$body`;
    while (ids.has(bodyId)) bodyId += "$";
    bodyIds.set(node.id, bodyId);
    ids.add(bodyId);
  }

  const g = new dagre.graphlib.Graph({ multigraph: true, compound: true });
  const compactScale =
    opts.compactSpacingScale ??
    (opts.spacingFactor > 0 ? opts.spacingFactor / 1.3 : 1);
  g.setGraph({
    rankdir: opts.rankDir,
    nodesep: opts.compact
      ? Math.max(opts.nodeSep, 24 * compactScale)
      : opts.nodeSep,
    edgesep: opts.compact
      ? Math.min(opts.edgeSep, 24 * compactScale)
      : opts.edgeSep,
    ranksep: opts.compact
      ? Math.min(opts.rankSep, 80 * compactScale)
      : opts.rankSep,
    ranker: "network-simplex",
  });
  g.setDefaultEdgeLabel(() => ({}));
  g.setDefaultNodeLabel(() => ({}));

  for (const node of nodes)
    g.setNode(node.id, { width: node.width + 2, height: node.height + 2 });
  for (const n of nodes)
    if (n.parent && ids.has(n.parent)) g.setParent(n.id, n.parent);
  for (const [parentId, bodyId] of bodyIds) {
    const node = byId.get(parentId)!;
    g.setNode(bodyId, { width: node.width + 2, height: node.height + 2 });
    g.setParent(bodyId, parentId);
  }
  for (const node of nodes) {
    if (parents.has(node.id) && !bodyIds.has(node.id)) continue;
    let ancestor = node.parent;
    const seen = new Set<string>();
    while (ancestor && !bodyIds.has(ancestor) && !seen.has(ancestor)) {
      seen.add(ancestor);
      ancestor = byId.get(ancestor)?.parent;
    }
    const parentBody = ancestor && bodyIds.get(ancestor);
    if (parentBody) g.setEdge(parentBody, bodyIds.get(node.id) ?? node.id, { minlen: 1, weight: 1 }, "parent-body");
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    const source = bodyIds.get(e.source) ?? e.source;
    const target = bodyIds.get(e.target) ?? e.target;
    if (parents.has(source) || parents.has(target)) continue;
    const label = measureEdgeLabel(
      e.label,
      e.icon ?? e.data?.icon,
      opts.edgeLabelFontSize,
    );
    const horizontal = opts.rankDir === "LR" || opts.rankDir === "RL";
    const length =
      (label.width ? label.width + 2 * LABEL_MARGIN_X : 0) +
      (e.connectorClearance ?? 0);
    g.setEdge(
      source,
      target,
      {
        minlen: 1,
        weight: 1,
        ...(length
          ? {
              width: horizontal ? length : Math.max(1, label.height),
              height: horizontal ? Math.max(1, label.height) : length,
              labelpos: "c",
            }
          : {}),
      },
      e.id,
    );
  }

  dagre.layout(g);

  const out = new Map<string, Point>();
  for (const n of nodes) {
    if (parents.has(n.id) && !bodyIds.has(n.id)) continue;
    const d = g.node(bodyIds.get(n.id) ?? n.id);
    if (d && Number.isFinite(d.x) && Number.isFinite(d.y))
      out.set(n.id, { x: d.x, y: d.y });
  }

  const sf = opts.compact ? 1 : opts.spacingFactor;
  if (sf && sf !== 1 && out.size) {
    let x1 = Infinity,
      y1 = Infinity,
      x2 = -Infinity,
      y2 = -Infinity;
    out.forEach((p) => {
      x1 = Math.min(x1, p.x);
      y1 = Math.min(y1, p.y);
      x2 = Math.max(x2, p.x);
      y2 = Math.max(y2, p.y);
    });
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    out.forEach((p, id) =>
      out.set(id, { x: cx + (p.x - cx) * sf, y: cy + (p.y - cy) * sf }),
    );
  }

  const alignment = opts.nodeAlignment ?? "center";
  if (alignment !== "center") {
    const horizontal = opts.rankDir === "LR" || opts.rankDir === "RL";
    const axis = horizontal ? "x" : "y";
    const dimension = horizontal ? "width" : "height";
    const flowSign = opts.rankDir === "RL" || opts.rankDir === "BT" ? -1 : 1;
    const offsetSign = alignment === "leading" ? -flowSign : flowSign;
    const rankSizes = new Map<number, number>();
    for (const node of nodes) {
      const position = out.get(node.id);
      if (!position) continue;
      const rank = position[axis];
      rankSizes.set(rank, Math.max(rankSizes.get(rank) ?? 0, node[dimension]));
    }
    for (const node of nodes) {
      const position = out.get(node.id);
      if (!position) continue;
      const rank = position[axis];
      const offset = (rankSizes.get(rank)! - node[dimension]) / 2;
      out.set(node.id, { ...position, [axis]: rank + offsetSign * offset });
    }
  }
  return out;
}

/**
 * Compound bounding boxes: children (leaf boxes or nested containers) expanded by
 * `padding(id)` on every side. Deepest containers are resolved first.
 */
export function computeContainers(
  nodes: { id: string; parent?: string }[],
  positions: Map<string, Point>,
  sizes: Map<string, { w: number; h: number }>,
  padding: (id: string) => number,
  minSize: (id: string) => { w: number; h: number } | undefined,
  fixedSizes?: ReadonlyMap<string, { w: number; h: number }>,
): Map<string, Rect> {
  const children = new Map<string, string[]>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (!n.parent || !byId.has(n.parent)) continue;
    const arr = children.get(n.parent);
    if (arr) arr.push(n.id);
    else children.set(n.parent, [n.id]);
  }
  const depth = (id: string, seen = new Set<string>()): number => {
    const p = byId.get(id)?.parent;
    if (!p || !byId.has(p) || seen.has(id)) return 0;
    seen.add(id);
    return 1 + depth(p, seen);
  };
  const order = [...children.keys()].sort((a, b) => depth(b) - depth(a));

  const rects = new Map<string, Rect>();
  for (const pid of order) {
    const fixedSize = fixedSizes?.get(pid);
    const position = positions.get(pid);
    if (fixedSize && position) {
      rects.set(pid, {
        x1: position.x - fixedSize.w / 2,
        y1: position.y - fixedSize.h / 2,
        x2: position.x + fixedSize.w / 2,
        y2: position.y + fixedSize.h / 2,
      });
      continue;
    }
    const bodySize = sizes.get(pid);
    let r: Rect | null = position && bodySize ? {
      x1: position.x - bodySize.w / 2,
      y1: position.y - bodySize.h / 2,
      x2: position.x + bodySize.w / 2,
      y2: position.y + bodySize.h / 2,
    } : null;
    for (const cid of children.get(pid) || []) {
      let cr: Rect | undefined = rects.get(cid);
      if (!cr) {
        const pos = positions.get(cid);
        if (!pos) continue;
        const s = sizes.get(cid) || { w: 60, h: 60 };
        cr = {
          x1: pos.x - s.w / 2,
          y1: pos.y - s.h / 2,
          x2: pos.x + s.w / 2,
          y2: pos.y + s.h / 2,
        };
      }
      r = r
        ? {
            x1: Math.min(r.x1, cr.x1),
            y1: Math.min(r.y1, cr.y1),
            x2: Math.max(r.x2, cr.x2),
            y2: Math.max(r.y2, cr.y2),
          }
        : { ...cr };
    }
    if (!r) continue;
    const pad = padding(pid);
    r = { x1: r.x1 - pad, y1: r.y1 - pad, x2: r.x2 + pad, y2: r.y2 + pad };
    const min = minSize(pid);
    if (min) {
      const w = r.x2 - r.x1;
      const h = r.y2 - r.y1;
      if (min.w > w) {
        const d = (min.w - w) / 2;
        r.x1 -= d;
        r.x2 += d;
      }
      if (min.h > h) {
        const d = (min.h - h) / 2;
        r.y1 -= d;
        r.y2 += d;
      }
    }
    rects.set(pid, r);
  }
  return rects;
}
