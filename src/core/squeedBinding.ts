import {
  NODE_TYPE_VIEWS,
  type FlowDiagramCallbacks,
  type FlowDiagramEdge,
} from "../types";
import { createFormNode } from "./createFormNode";
import type { FormSchema } from "./forms";
import { applyFormChange } from "./forms";
import {
  addChild,
  addConnection,
  addTargetEdge,
  getNode,
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
    | "documentReplace"
    | "form"
    | "nodeLabel"
    | "nodeContent"
    | "nodeColor"
    | "nodeStyle"
    | "nodeIcon"
    | "nodeOutline"
    | "nodeAnimation"
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
  formSchema?: FormSchema,
): FlowDiagramCallbacks {
  const emit = (next: SqueedJson, change: SqueedChange) => {
    if (next === json) return;
    json = next;
    onJsonChange?.(next, change);
  };
  const edgeRef = (edgeId: string): RenderedEdgeRef | undefined => {
    const d = compiledEdges.find((e) => e.data.id === edgeId)?.data;
    return (
      d && {
        source: d.source,
        target: d.target,
        isInverted: d.isInverted,
        sourceProperty: d.sourceProperty,
        targetProperty: d.targetProperty,
        connection: d.connection,
      }
    );
  };

  return {
    ...callbacks,
    onFormChange: (event) => {
      const owner = getNode(json, event.nodeAddress);
      if (!owner || (event.nodeId !== undefined && owner.id !== event.nodeId))
        throw new Error("This form node has moved. Retry the edit.");
      emit(applyFormChange(json, event, callbacks.onFormChange), {
        type: "form",
        address: event.address,
        value: event.value,
      });
    },
    onNodeLabelChange: (id, label) => {
      callbacks.onNodeLabelChange?.(id, label);
      emit(setNodeProp(json, id, "$label", label), {
        type: "nodeLabel",
        address: id,
        key: "$label",
        value: label,
      });
    },
    onNodeContentChange: (id, content) => {
      callbacks.onNodeContentChange?.(id, content);
      emit(setNodeProp(json, id, "$content", content), {
        type: "nodeContent",
        address: id,
        key: "$content",
        value: content,
      });
    },
    onNodeTypeViewChange: (id, view) => {
      if (view !== undefined && !NODE_TYPE_VIEWS.includes(view)) return;
      callbacks.onNodeTypeViewChange?.(id, view);
      emit(setNodeProp(json, id, "$view", view), {
        type: "nodeStyle",
        address: id,
        key: "$view",
        value: view,
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
    onNodeBorderColorChange: (id, color) => {
      callbacks.onNodeBorderColorChange?.(id, color);
      emit(setNodeProp(json, id, "$borderColor", color), {
        type: "nodeColor",
        address: id,
        key: "$borderColor",
        value: color,
      });
    },
    onNodeBorderStyleChange: (id, style) => {
      callbacks.onNodeBorderStyleChange?.(id, style);
      emit(setNodeProp(json, id, "$borderStyle", style), {
        type: "nodeStyle",
        address: id,
        key: "$borderStyle",
        value: style,
      });
    },
    onNodeBorderWidthChange: (id, width) => {
      if (width !== undefined && (!Number.isFinite(width) || width < 0)) return;
      callbacks.onNodeBorderWidthChange?.(id, width);
      emit(setNodeProp(json, id, "$borderWidth", width), {
        type: "nodeStyle",
        address: id,
        key: "$borderWidth",
        value: width,
      });
    },
    onNodeBorderRadiusChange: (id, radius) => {
      if (radius !== undefined && (!Number.isFinite(radius) || radius < 0))
        return;
      callbacks.onNodeBorderRadiusChange?.(id, radius);
      emit(setNodeProp(json, id, "$borderRadius", radius), {
        type: "nodeStyle",
        address: id,
        key: "$borderRadius",
        value: radius,
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
    onNodeOutlineChange: (id, outline) => {
      callbacks.onNodeOutlineChange?.(id, outline);
      emit(setNodeProp(json, id, "$outline", outline), {
        type: "nodeOutline",
        address: id,
        key: "$outline",
        value: outline,
      });
    },
    onNodeAnimationChange: (id, animated) => {
      callbacks.onNodeAnimationChange?.(id, animated);
      emit(setNodeProp(json, id, "$isNodeAnimated", animated), {
        type: "nodeAnimation",
        address: id,
        key: "$isNodeAnimated",
        value: animated,
      });
    },
    onNodeAnimationVariantChange: (id, variant) => {
      if (variant !== "traveling" && variant !== "pulse") return;
      callbacks.onNodeAnimationVariantChange?.(id, variant);
      emit(setNodeProp(json, id, "$nodeAnimationVariant", variant), {
        type: "nodeAnimation",
        address: id,
        key: "$nodeAnimationVariant",
        value: variant,
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
      const created =
        params.sourceNodeId &&
        createFormNode(json, params.sourceNodeId, formSchema);
      if (created) {
        callbacks.onNodeCreate?.(params);
        emit(created.json, {
          type: "nodeCreate",
          address: created.address,
          value: "form",
        });
        return;
      }
      callbacks.onNodeCreate?.(params);
      const parent = params.sourceNodeId || "root";
      const parentNode = getNode(json, parent);
      // set mode → object child, array mode → array child; the compiler labels them by key
      const key = uniqueKey(parentNode, params.isArrayMode ? "list" : "node");
      const child = params.isArrayMode
        ? { $bgColor: "gray.500", $: [] }
        : { $bgColor: "gray.500" };
      const res = addChild(json, parent, child, key);
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
    onEdgeCreate: (source, target, properties) => {
      callbacks.onEdgeCreate?.(source, target, properties);
      const connection =
        properties &&
        (properties.sourceProperty !== undefined ||
          properties.targetProperty !== undefined)
          ? { ...properties, target }
          : undefined;
      emit(
        connection
          ? addConnection(json, source, connection)
          : addTargetEdge(json, source, target),
        {
          type: "edgeCreate",
          address: source,
          key: connection ? "$connections" : "$target",
          value: connection ?? target,
        },
      );
    },
    onEdgeLabelChange: (edgeId, label) => {
      callbacks.onEdgeLabelChange?.(edgeId, label);
      const ref = edgeRef(edgeId);
      if (ref)
        emit(setEdgeProp(json, ref, "$sourceLabel", label), {
          type: "edgeLabel",
          edge: ref,
          key: ref.connection ? "$connections" : "$sourceLabel",
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
    onEdgeAnimationVariantChange: (edgeId, variant) => {
      if (variant !== "dashed" && variant !== "traveling") return;
      callbacks.onEdgeAnimationVariantChange?.(edgeId, variant);
      const ref = edgeRef(edgeId);
      if (ref)
        emit(setEdgeProp(json, ref, "$edgeAnimationVariant", variant), {
          type: "edgeStyle",
          edge: ref,
          key: ref.connection ? "$connections" : "$edgeAnimationVariant",
          value: variant,
        });
    },
    onEdgeTypeChange: (edgeId, type) => {
      callbacks.onEdgeTypeChange?.(edgeId, type);
      const ref = edgeRef(edgeId);
      if (ref)
        emit(setEdgeProp(json, ref, "$edgeType", type), {
          type: "edgeStyle",
          edge: ref,
          key: ref.connection ? "$connections" : "$edgeType",
          value: type,
        });
    },
    onEdgeIconChange: (edgeId, icon) => {
      callbacks.onEdgeIconChange?.(edgeId, icon);
      const ref = edgeRef(edgeId);
      if (ref)
        emit(setEdgeProp(json, ref, "$edgeIcon", icon || undefined), {
          type: "edgeStyle",
          edge: ref,
          key: ref.connection ? "$connections" : "$edgeIcon",
          value: icon,
        });
    },
    onEdgeColorChange: (edgeId, color) => {
      callbacks.onEdgeColorChange?.(edgeId, color);
      const ref = edgeRef(edgeId);
      if (ref)
        emit(setEdgeProp(json, ref, "$edgeColor", color), {
          type: "edgeColor",
          edge: ref,
          key: ref.connection ? "$connections" : "$edgeColor",
          value: color,
        });
    },
    onEdgeDelete: (edgeId, data) => {
      callbacks.onEdgeDelete?.(edgeId, data);
      const ref = edgeRef(edgeId);
      if (!ref) return;
      const res = removeEdge(json, ref);
      if (res.removed)
        emit(res.json, {
          type: "edgeDelete",
          edge: ref,
          key: ref.connection ? "$connections" : "$target",
        });
    },
  };
}
