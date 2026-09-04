import type { FlowDiagramEdge, FlowDiagramNode } from "../types";
import { createFlowDiagram } from "./createFlowDiagram";
import { collectConfigObject } from "./createFlowDiagramComponents";

/**
 * Squeed JSON = the source document `createFlowDiagram` compiles into nodes/edges.
 * Node ids are JSON addresses ("root.a.b"); these helpers translate toolbar edits
 * back into `$`-prefixed schema keys at that address. All functions are immutable.
 */
export type SqueedJson = Record<string, any> | any[];

/** Schema keys that live on a node */
export type SqueedNodeKey =
  | "$label"
  | "$bgColor"
  | "$textColor"
  | "$borderColor"
  | "$borderRadius"
  | "$fontSize"
  | "$icon"
  | "$content"
  | "$media"
  | "$collapsed"
  | "$parent";

/** Schema keys that describe the edge *into* a node (parent → child) */
export type SqueedEdgeKey =
  | "$sourceLabel"
  | "$isEdgeAnimated"
  | "$isEdgeDashed"
  | "$edgeColor";

const ROOT = "root";
// ".#" = duplicate-path marker, "{3}" / " 3" = synthetic count nodes emitted by the compiler
const isDecorator = (seg: string) =>
  seg === "#" || seg.startsWith("{") || /^\s\d*$/.test(seg);

/** "root.a.b.#" → ["a", "b"] */
export function addressToPath(address: string): string[] {
  const segs = address.split(".");
  if (segs[0] === ROOT) segs.shift();
  while (segs.length && isDecorator(segs[segs.length - 1])) segs.pop();
  return segs.filter((s) => !isDecorator(s));
}

/** Children may be nested under a "$" array; mirror the compiler's descent */
function childContainer(node: any): any {
  if (node == null || typeof node !== "object") return node;
  const { arrayObject } = collectConfigObject(node);
  return Array.isArray(arrayObject) && arrayObject.length ? arrayObject : node;
}

export function getNode(json: SqueedJson, address: string): any {
  return addressToPath(address).reduce((acc, seg) => {
    if (acc == null) return undefined;
    return childContainer(acc)?.[seg];
  }, json as any);
}

function cloneShallow(v: any) {
  return Array.isArray(v) ? [...v] : { ...v };
}

/** Immutable update of the node at `address` (root address updates the document itself) */
export function updateNode(
  json: SqueedJson,
  address: string,
  fn: (node: any) => any,
): SqueedJson {
  const path = addressToPath(address);
  const walk = (node: any, i: number): any => {
    if (i === path.length) return fn(node);
    const seg = path[i];
    const { arrayObject } = collectConfigObject(node);
    const usesDollarArray =
      Array.isArray(arrayObject) && arrayObject.length > 0;
    const container = usesDollarArray ? arrayObject : node;
    if (container == null || typeof container !== "object") return node;
    const nextContainer = cloneShallow(container);
    nextContainer[seg] = walk(container[seg], i + 1);
    return usesDollarArray ? { ...node, $: nextContainer } : nextContainer;
  };
  return walk(json, 0);
}

/** Leaves become objects when they gain schema keys; "" / null / undefined delete the key */
function withKey(node: any, key: string, value: any) {
  const remove = value === "" || value === undefined || value === null;
  // Arrays can't carry `$` keys through JSON serialization; use the `{ $key, $: [...] }` wrapper form
  if (Array.isArray(node)) {
    if (remove) return node;
    return { [key]: value, $: [...node] };
  }
  const base = node != null && typeof node === "object" ? { ...node } : {};
  if (node != null && typeof node !== "object") base.$label = String(node);
  if (remove) delete base[key];
  else base[key] = value;
  return base;
}

export function setNodeProp(
  json: SqueedJson,
  address: string,
  key: SqueedNodeKey,
  value: any,
): SqueedJson {
  return updateNode(json, address, (n) => withKey(n, key, value));
}

export const setCollapsed = (
  json: SqueedJson,
  address: string,
  collapsed: boolean,
) => setNodeProp(json, address, "$collapsed", collapsed || undefined);

export interface RenderedEdgeRef {
  source: string;
  target: string;
  isInverted?: boolean | null;
}

/**
 * Resolve which JSON node carries an edge's keys.
 * parent→child edges (implicit hierarchy) are configured on the child;
 * `$target` cross-links are configured on the source node.
 */
export function resolveEdgeOwner(edge: RenderedEdgeRef): {
  address: string;
  kind: "hierarchy" | "target";
} {
  const src = edge.isInverted ? edge.target : edge.source;
  const tgt = edge.isInverted ? edge.source : edge.target;
  const a = addressToPath(src).join("."),
    b = addressToPath(tgt).join(".");
  if (b.startsWith(a ? a + "." : "") && b !== a)
    return { address: tgt, kind: "hierarchy" };
  if (a.startsWith(b ? b + "." : "") && a !== b)
    return { address: src, kind: "hierarchy" };
  return { address: src, kind: "target" };
}

export function setEdgeProp(
  json: SqueedJson,
  edge: RenderedEdgeRef,
  key: SqueedEdgeKey,
  value: any,
): SqueedJson {
  const { address, kind } = resolveEdgeOwner(edge);
  const k = kind === "target" && key === "$sourceLabel" ? "$targetLabel" : key;
  return updateNode(json, address, (n) => withKey(n, k, value));
}

export const setEdgeStyle = (
  json: SqueedJson,
  edge: RenderedEdgeRef,
  style: "solid" | "dashed" | "animated",
) =>
  setEdgeProp(
    setEdgeProp(
      json,
      edge,
      "$isEdgeAnimated",
      style === "animated" || undefined,
    ),
    edge,
    "$isEdgeDashed",
    style === "dashed" || undefined,
  );

/** Add a child under `parentAddress`. Returns the new node's address. */
export function addChild(
  json: SqueedJson,
  parentAddress: string,
  child: any,
  key?: string,
): { json: SqueedJson; address: string } {
  let newKey = key || "";
  const next = updateNode(json, parentAddress, (n) => {
    const base =
      n != null && typeof n === "object" && !Array.isArray(n)
        ? { ...n }
        : n != null && typeof n !== "object"
          ? { $label: String(n) }
          : {};
    if (Array.isArray(n)) {
      newKey = String(n.length);
      return [...n, child];
    }
    if (!newKey) {
      let i = 1;
      while (`node_${i}` in base) i++;
      newKey = `node_${i}`;
    }
    base[newKey] = child;
    return base;
  });
  const parentPath = addressToPath(parentAddress);
  return { json: next, address: [ROOT, ...parentPath, newKey].join(".") };
}

export function removeNode(json: SqueedJson, address: string): SqueedJson {
  const path = addressToPath(address);
  if (!path.length) return json;
  const last = path[path.length - 1];
  const parentAddress = [ROOT, ...path.slice(0, -1)].join(".");
  return updateNode(json, parentAddress, (n) => {
    const { arrayObject } = collectConfigObject(n);
    if (Array.isArray(arrayObject) && arrayObject.length) {
      return { ...n, $: arrayObject.filter((_, i) => String(i) !== last) };
    }
    if (Array.isArray(n)) return n.filter((_, i) => String(i) !== last);
    const { [last]: _omit, ...rest } = n;
    return rest;
  });
}

/** `$target` cross-link (the compiler supports one per node; an existing one is replaced) */
export const addTargetEdge = (
  json: SqueedJson,
  sourceAddress: string,
  targetAddress: string,
  label?: string,
) =>
  setNodeProp(
    label
      ? updateNode(json, sourceAddress, (n) =>
          withKey(n, "$targetLabel", label),
        )
      : json,
    sourceAddress,
    // $target is a node key in the schema even though it describes an edge
    "$target" as SqueedNodeKey,
    targetAddress,
  );

/** Removes a `$target` edge; hierarchy edges cannot be removed without removing the child (returns json unchanged). */
export function removeEdge(
  json: SqueedJson,
  edge: RenderedEdgeRef,
): { json: SqueedJson; removed: boolean } {
  const { address, kind } = resolveEdgeOwner(edge);
  if (kind !== "target") return { json, removed: false };
  const next = updateNode(json, address, (n) => {
    const { $target: _t, $targetLabel: _l, ...rest } = n || {};
    return rest;
  });
  return { json: next, removed: true };
}

export interface CompileOptions {
  title?: string;
  /** Root in the middle, children fan out both ways (direction "C") */
  isCenter?: boolean;
  hideDefaultObject?: boolean;
  separateObjectKeys?: boolean;
}

/**
 * `createFlowDiagram` + post-pass:
 * - deterministic edge ids (`source->target[#n]`) so selection survives regeneration
 * - honors `$isEdgeDashed` / `$edgeColor`, which the compiler doesn't read
 * - `$label` wins over the compiler's shared-config `headerTitle` (it leaks the previous node's title)
 */
export function compileSqueed(
  json: SqueedJson,
  opts: CompileOptions = {},
): { nodes: FlowDiagramNode[]; edges: FlowDiagramEdge[] } {
  const { nodes, edges } = createFlowDiagram(
    json,
    ROOT,
    [],
    [],
    opts.title || "untitled",
    {
      hideDefaultObject: !!opts.hideDefaultObject,
      sprtObjctKy: !!opts.separateObjectKeys,
      isCntr: !!opts.isCenter,
    },
  );
  const outNodes: FlowDiagramNode[] = nodes.map((n) => {
    const src = getNode(json, n.data.id);
    if (!src || typeof src !== "object" || Array.isArray(src)) return n;
    const data = { ...n.data };
    if (typeof src.$label === "string") {
      data.label = src.$label;
      data.headerTitle = src.$label;
    }
    if (src.$collapsed !== undefined || src.$icon !== undefined) {
      data.config = { ...(data.config || {}) };
      if (src.$collapsed !== undefined)
        data.config.collapsed = !!src.$collapsed;
      if (src.$icon !== undefined) data.config.icon = src.$icon;
    }
    return { data };
  });
  const seen = new Map<string, number>();
  const outEdges: FlowDiagramEdge[] = edges.map((e) => {
    const base = `${e.data.source}->${e.data.target}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const owner = getNode(json, resolveEdgeOwner(e.data).address);
    const data: FlowDiagramEdge["data"] = {
      ...e.data,
      id: n ? `${base}#${n}` : base,
    };
    if (owner && typeof owner === "object") {
      if (owner.$isEdgeAnimated !== undefined)
        data.isEdgeAnimated = !!owner.$isEdgeAnimated;
      if (owner.$isEdgeDashed !== undefined)
        data.isEdgeDashed = !!owner.$isEdgeDashed;
      if (owner.$edgeColor) data.color = owner.$edgeColor;
    }
    return { data };
  });
  return { nodes: outNodes, edges: outEdges };
}

/**
 * For hand-built graphs (no Squeed JSON): hide everything downstream of a node whose
 * `data.config.collapsed` is true, plus the edges touching hidden nodes.
 */
export function applyCollapsed(
  nodes: FlowDiagramNode[],
  edges: FlowDiagramEdge[],
) {
  const collapsed = new Set(
    nodes.filter((n) => n.data?.config?.collapsed).map((n) => n.data.id),
  );
  if (!collapsed.size) return { nodes, edges };
  const out = new Map<string, string[]>();
  for (const e of edges) {
    const s = e.data.isInverted ? e.data.target : e.data.source;
    const t = e.data.isInverted ? e.data.source : e.data.target;
    (out.get(s) ?? out.set(s, []).get(s)!).push(t);
  }
  const hidden = new Set<string>();
  for (const root of collapsed) {
    const stack = [...(out.get(root) || [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (collapsed.has(id) || hidden.has(id)) continue;
      hidden.add(id);
      stack.push(...(out.get(id) || []));
    }
  }
  return {
    nodes: nodes.filter((n) => !hidden.has(n.data.id)),
    edges: edges.filter(
      (e) => !hidden.has(e.data.source) && !hidden.has(e.data.target),
    ),
  };
}
