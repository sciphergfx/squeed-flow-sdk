import dagre from "dagre";
import type { NodeAlignment } from "../types";
import type { Point, Rect } from "./types";
import { LABEL_MARGIN_X, measureEdgeLabel } from "./edgeLabel";

export interface LayoutNodeInput {
  id: string;
  parent?: string;
  width: number;
  height: number;
}

export interface LayoutEdgeInput {
  id: string;
  source: string;
  target: string;
  label?: string;
  icon?: string;
  data?: { icon?: string };
}

export interface LayoutOptions {
  rankDir: "LR" | "RL" | "TB" | "BT";
  compact?: boolean;
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
  const parents = new Set<string>();
  for (const n of nodes)
    if (n.parent && ids.has(n.parent)) parents.add(n.parent);

  const g = new dagre.graphlib.Graph({ multigraph: true, compound: true });
  const compactScale = opts.spacingFactor > 0 ? opts.spacingFactor / 1.3 : 1;
  g.setGraph({
    rankdir: opts.rankDir,
    nodesep: opts.nodeSep,
    edgesep: opts.compact ? Math.min(opts.edgeSep, 24 * compactScale) : opts.edgeSep,
    ranksep: opts.compact ? Math.min(opts.rankSep, 80 * compactScale) : opts.rankSep,
    ranker: "network-simplex",
  });
  g.setDefaultEdgeLabel(() => ({}));
  g.setDefaultNodeLabel(() => ({}));

  for (const node of nodes)
    g.setNode(node.id, { width: node.width + 2, height: node.height + 2 });
  for (const n of nodes)
    if (n.parent && ids.has(n.parent)) g.setParent(n.id, n.parent);
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    if (parents.has(e.source) || parents.has(e.target)) continue;
    const label = measureEdgeLabel(e.label, e.icon ?? e.data?.icon);
    const horizontal = opts.rankDir === "LR" || opts.rankDir === "RL";
    const length = label.width + 2 * LABEL_MARGIN_X;
    g.setEdge(
      e.source,
      e.target,
      {
        minlen: 1,
        weight: 1,
        ...(label.width
          ? {
              width: horizontal ? length : label.height,
              height: horizontal ? label.height : length,
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
    if (parents.has(n.id)) continue;
    const d = g.node(n.id);
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
    let r: Rect | null = null;
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
