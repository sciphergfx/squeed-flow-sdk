import type { FlowDiagramCallbacks, FlowDiagramEdge } from "../types";
import {
  addChild,
  addTargetEdge,
  removeEdge,
  removeNode,
  setCollapsed,
  setEdgeProp,
  setEdgeStyle,
  setNodeProp,
  type RenderedEdgeRef,
  type SqueedJson,
} from "./squeedEdits";

/** What changed in the Squeed document (delivered alongside the new JSON) */
export interface SqueedChange {
  type:
    | "nodeLabel"
    | "nodeColor"
    | "nodeIcon"
    | "nodeCollapse"
    | "nodeCreate"
    | "nodeDelete"
    | "edgeLabel"
    | "edgeStyle"
    | "edgeColor"
    | "edgeCreate"
    | "edgeDelete";
  /** Node address affected (new node's address for nodeCreate) */
  address?: string;
  edge?: RenderedEdgeRef;
  /** `$` key written, when a single key changed */
  key?: string;
  value?: unknown;
}

function uniqueKey(parent: any, prefix: string) {
  const has = (k: string) =>
    parent && typeof parent === "object" && k in parent;
  let i = 1;
  while (has(`${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
}

/**
 * Wrap consumer callbacks so every toolbar/edit event is applied to `json`
 * with Squeed `$` keys and delivered via `onJsonChange`. Granular callbacks
 * still fire first (for logging/analytics) — consumers must not also mutate.
 */
export function bindSqueedCallbacks(
  json: SqueedJson,
  compiledEdges: FlowDiagramEdge[],
  callbacks: FlowDiagramCallbacks,
  onJsonChange?: (json: SqueedJson, change: SqueedChange) => void,
): FlowDiagramCallbacks {
  const emit = (next: SqueedJson, change: SqueedChange) => {
    if (next !== json) onJsonChange?.(next, change);
  };
  const edgeRef = (edgeId: string): RenderedEdgeRef | undefined => {
    const d = compiledEdges.find((e) => e.data.id === edgeId)?.data;
    return (
      d && { source: d.source, target: d.target, isInverted: d.isInverted }
    );
  };

  return {
    ...callbacks,
    onNodeLabelChange: (id, label) => {
      callbacks.onNodeLabelChange?.(id, label);
      emit(setNodeProp(json, id, "$label", label), {
        type: "nodeLabel",
        address: id,
        key: "$label",
        value: label,
      });
    },
    onNodeColorChange: (id, kind, color) => {
      callbacks.onNodeColorChange?.(id, kind, color);
      const key = kind === "bg" ? "$bgColor" : "$textColor";
      emit(setNodeProp(json, id, key, color), {
        type: "nodeColor",
        address: id,
        key,
        value: color,
      });
    },
    onNodeIconChange: (id, icon) => {
      callbacks.onNodeIconChange?.(id, icon);
      emit(setNodeProp(json, id, "$icon", icon), {
        type: "nodeIcon",
        address: id,
        key: "$icon",
        value: icon,
      });
    },
    onNodeCollapse: (id, collapsed) => {
      callbacks.onNodeCollapse?.(id, collapsed);
      emit(setCollapsed(json, id, collapsed), {
        type: "nodeCollapse",
        address: id,
        key: "$collapsed",
        value: collapsed,
      });
    },
    onNodeCreate: (params) => {
      callbacks.onNodeCreate?.(params);
      const parent = params.sourceNodeId || "root";
      const parentNode = parent === "root" ? json : undefined;
      // set mode → object child, array mode → array child; the compiler labels them by key
      const key = uniqueKey(parentNode, params.isArrayMode ? "list" : "node");
      const res = addChild(json, parent, params.isArrayMode ? [] : {}, key);
      emit(res.json, {
        type: "nodeCreate",
        address: res.address,
        value: params.isArrayMode ? "array" : "set",
      });
    },
    onNodeDelete: (id, data) => {
      callbacks.onNodeDelete?.(id, data);
      emit(removeNode(json, id), { type: "nodeDelete", address: id });
    },
    onEdgeCreate: (s, t) => {
      callbacks.onEdgeCreate?.(s, t);
      emit(addTargetEdge(json, s, t), {
        type: "edgeCreate",
        address: s,
        key: "$target",
        value: t,
      });
    },
    onEdgeLabelChange: (edgeId, label) => {
      callbacks.onEdgeLabelChange?.(edgeId, label);
      const ref = edgeRef(edgeId);
      if (ref)
        emit(setEdgeProp(json, ref, "$sourceLabel", label), {
          type: "edgeLabel",
          edge: ref,
          key: "$sourceLabel",
          value: label,
        });
    },
    onEdgeStyleChange: (edgeId, style) => {
      callbacks.onEdgeStyleChange?.(edgeId, style);
      const ref = edgeRef(edgeId);
      if (ref)
        emit(setEdgeStyle(json, ref, style), {
          type: "edgeStyle",
          edge: ref,
          value: style,
        });
    },
    onEdgeColorChange: (edgeId, color) => {
      callbacks.onEdgeColorChange?.(edgeId, color);
      const ref = edgeRef(edgeId);
      if (ref)
        emit(setEdgeProp(json, ref, "$edgeColor", color), {
          type: "edgeColor",
          edge: ref,
          key: "$edgeColor",
          value: color,
        });
    },
    onEdgeDelete: (edgeId, data) => {
      callbacks.onEdgeDelete?.(edgeId, data);
      const ref = edgeRef(edgeId);
      if (!ref) return;
      const res = removeEdge(json, ref);
      if (res.removed)
        emit(res.json, { type: "edgeDelete", edge: ref, key: "$target" });
    },
  };
}
