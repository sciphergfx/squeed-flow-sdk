import { v4 as uuidv4 } from "uuid";
import type {
  FlowDiagramEdge,
  FlowDiagramNode,
  FlowEdgeProperties,
  SqueedConnection,
  SqueedConnectionRef,
} from "../types";
import { createFlowDiagram } from "./createFlowDiagram";
import { applyParentGroups } from "./parentGroups";
import {
  connectionEntries,
  prepareConnections,
  updateConnection,
} from "./squeedConnections";

/**
 * Squeed JSON = the source document `createFlowDiagram` compiles into nodes/edges.
 * Node ids are JSON addresses ("root.a.b"); these helpers translate toolbar edits
 * back into `$`-prefixed schema keys at that address. All functions are immutable.
 */
export type SqueedJson = Record<string, any> | any[];

/** Schema keys that live on a node */
export type SqueedNodeKey =
  | "$view"
  | "$label"
  | "$subtitle"
  | "$form"
  | "$bgColor"
  | "$textColor"
  | "$borderColor"
  | "$borderStyle"
  | "$borderWidth"
  | "$borderRadius"
  | "$fontSize"
  | "$icon"
  | "$content"
  | "$media"
  | "$collapsed"
  | "$parent"
  | "$outline"
  | "$isNodeAnimated"
  | "$nodeAnimationVariant"
  | "$connections"
  | "$ports";

/** Schema keys that describe the edge *into* a node (parent → child) */
export type SqueedEdgeKey =
  | "$edgeIcon"
  | "$edgeType"
  | "$sourceLabel"
  | "$isEdgeAnimated"
  | "$edgeAnimationVariant"
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
  return Array.isArray(node.$) ? node.$ : node;
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
    const container = childContainer(node);
    if (container == null || typeof container !== "object") return node;
    const child = walk(container[seg], i + 1);
    if (Object.is(child, container[seg])) return node;
    const nextContainer = cloneShallow(container);
    nextContainer[seg] = child;
    return container !== node ? { ...node, $: nextContainer } : nextContainer;
  };
  return walk(json, 0);
}

/** Leaves gain objects for schema keys; null/undefined reset keys, while empty content is retained. */
function withKey(node: any, key: string, value: any) {
  const remove =
    (value === "" && key !== "$content") ||
    value === undefined ||
    value === null;
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
  return updateNode(json, address, (node) =>
    key === "$label" &&
    typeof node === "string" &&
    typeof value === "string" &&
    value !== ""
      ? value
      : withKey(node, key, value),
  );
}

export const setCollapsed = (
  json: SqueedJson,
  address: string,
  collapsed: boolean,
) => setNodeProp(json, address, "$collapsed", collapsed);

export interface RenderedEdgeRef extends FlowEdgeProperties {
  source: string;
  target: string;
  isInverted?: boolean | null;
  connection?: SqueedConnectionRef;
  collapsedEndpoints?: { source: string; target: string };
}

/**
 * Resolve which JSON node carries an edge's keys.
 * parent→child edges (implicit hierarchy) are configured on the child;
 * `$target` cross-links are configured on the source node.
 */
export function resolveEdgeOwner(edge: RenderedEdgeRef): {
  address: string;
  kind: "hierarchy" | "target" | "connection";
} {
  if (edge.connection)
    return { address: edge.connection.address, kind: "connection" };
  const endpoints = edge.collapsedEndpoints ?? edge;
  const src = edge.isInverted ? endpoints.target : endpoints.source;
  const tgt = edge.isInverted ? endpoints.source : endpoints.target;
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
  if (edge.connection) {
    const reference = edge.connection;
    return updateNode(json, reference.address, (node) =>
      updateConnection(node, reference.key, (connection) => {
        if (key === "$edgeIcon") return withKey(connection, "icon", value);
        if (key === "$edgeType") return withKey(connection, "type", value);
        if (key === "$edgeAnimationVariant")
          return withKey(connection, "animationVariant", value);
        if (key === "$sourceLabel" || key === "$edgeColor")
          return withKey(
            connection,
            key === "$sourceLabel" ? "label" : "color",
            value,
          );
        const style = key === "$isEdgeAnimated" ? "animated" : "dashed";
        return value
          ? { ...connection, style }
          : connection.style === style
            ? withKey(connection, "style", undefined)
            : connection;
      }),
    );
  }
  const { address, kind } = resolveEdgeOwner(edge);
  const k =
    kind === "target" && key === "$sourceLabel"
      ? "$targetLabel"
      : kind === "target" && key === "$edgeType"
        ? "$targetEdgeType"
        : kind === "target" && key === "$edgeIcon"
          ? "$targetIcon"
          : kind === "target" && key === "$edgeAnimationVariant"
            ? "$targetAnimationVariant"
            : key;
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
    const container = childContainer(n);
    if (Array.isArray(container)) {
      newKey = String(container.length);
      const children = [...container, child];
      return container === n ? children : { ...n, $: children };
    }
    const base =
      n != null && typeof n === "object" && !Array.isArray(n)
        ? { ...n }
        : n != null && typeof n !== "object"
          ? { $label: String(n) }
          : {};
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
    const container = childContainer(n);
    if (
      container == null ||
      typeof container !== "object" ||
      !Object.prototype.hasOwnProperty.call(container, last)
    )
      return n;
    if (Array.isArray(container)) {
      const children = container.filter((_, index) => String(index) !== last);
      return container === n ? children : { ...n, $: children };
    }
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

export function addConnection(
  json: SqueedJson,
  sourceAddress: string,
  connection: SqueedConnection,
): SqueedJson {
  const node = getNode(json, sourceAddress);
  const entries = connectionEntries(node);
  if (
    entries.some(
      ({ value }) =>
        value.target === connection.target &&
        value.sourceProperty === connection.sourceProperty &&
        value.targetProperty === connection.targetProperty,
    )
  )
    return json;
  return updateNode(json, sourceAddress, (current) =>
    withKey(current, "$connections", [
      ...(Array.isArray(current?.$connections) ? current.$connections : []),
      { ...connection, id: connection.id || uuidv4() },
    ]),
  );
}

/** Removes explicit edges or suppresses a hierarchy edge without deleting its child. */
export function removeEdge(
  json: SqueedJson,
  edge: RenderedEdgeRef,
): { json: SqueedJson; removed: boolean } {
  if (edge.connection) {
    const reference = edge.connection;
    if (
      !connectionEntries(getNode(json, reference.address)).some(
        (entry) => entry.key === reference.key,
      )
    )
      return { json, removed: false };
    return {
      json: updateNode(json, reference.address, (node) =>
        updateConnection(node, reference.key, () => null),
      ),
      removed: true,
    };
  }
  const { address, kind } = resolveEdgeOwner(edge);
  if (kind === "hierarchy") {
    if (getNode(json, address) === undefined) return { json, removed: false };
    return {
      json: updateNode(json, address, (node) => ({
        ...node,
        $hideParentEdge: true,
      })),
      removed: true,
    };
  }
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
  const prepared = prepareConnections(json);
  const { nodes, edges } = createFlowDiagram(
    prepared.json,
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
  const renderedIds = new Set(nodes.map((node) => node.data.id));
  const leafAddresses = new Map<string, string>();
  for (const node of nodes) {
    const id = node.data.id;
    if (!id.endsWith(".0") || getNode(json, id) !== undefined) continue;
    const address = id.slice(0, -2);
    const source = getNode(json, address);
    if (
      !renderedIds.has(address) &&
      source &&
      typeof source === "object" &&
      !Array.isArray(source) &&
      typeof source.$label === "string" &&
      Object.keys(source).every((key) => key.startsWith("$") && key !== "$")
    ) {
      leafAddresses.set(id, address);
    }
  }
  const canonicalAddress = (id: string) => leafAddresses.get(id) ?? id;
  const parentIds = new Set(
    nodes.flatMap((node) =>
      node.data.parent ? [canonicalAddress(node.data.parent)] : [],
    ),
  );
  const centerSides = new Map<string, boolean>();
  if (opts.isCenter) {
    const incomingSides = new Map<string, boolean | null>();
    for (const { data } of edges) {
      const owner = resolveEdgeOwner(data);
      if (owner.kind === "hierarchy") {
        centerSides.set(canonicalAddress(owner.address), !!data.isInverted);
      } else if (!Array.isArray(json) && json.$hideRoot === true) {
        const target = canonicalAddress(
          data.isInverted ? data.source : data.target,
        );
        if (addressToPath(target).length !== 1) continue;
        const side = !!data.isInverted;
        incomingSides.set(
          target,
          incomingSides.has(target) && incomingSides.get(target) !== side
            ? null
            : side,
        );
      }
    }
    for (const [address] of centerSides) {
      const root = `${ROOT}.${addressToPath(address)[0]}`;
      const incoming = incomingSides.get(root);
      if (typeof incoming === "boolean") centerSides.set(address, incoming);
    }
  }
  const outNodes: FlowDiagramNode[] = nodes.map((n) => {
    const id = canonicalAddress(n.data.id);
    const src = getNode(json, id);
    const data = { ...n.data, id };
    if (centerSides.has(id)) {
      data.config = { ...data.config, isInverted: centerSides.get(id) };
    }
    const childSource =
      src && typeof src === "object" && !Array.isArray(src) && "$" in src
        ? src.$
        : src;
    const hasChildren = Array.isArray(childSource)
      ? childSource.length > 0
      : childSource &&
        typeof childSource === "object" &&
        Object.keys(childSource).some((key) => !key.startsWith("$"));
    if (hasChildren) {
      data.config = { ...data.config, collapsed: !!src.$collapsed };
    }
    if (!parentIds.has(id)) {
      data.viewProps = { ...data.viewProps };
      delete data.viewProps.borderWidth;
    }
    if (!src || typeof src !== "object" || Array.isArray(src)) return { data };
    if (src.$form && typeof src.$form === "object") {
      data.config = { ...data.config, form: src.$form };
      data.type = "objectView";
    }
    if (Array.isArray(src.$ports)) {
      const ports = src.$ports.filter(
        (port: any) =>
          port &&
          typeof port.id === "string" &&
          ["source", "target"].includes(port.role) &&
          ["top", "right", "bottom", "left"].includes(port.side),
      );
      data.config = { ...data.config, ports };
    }
    if (data.parent) data.parent = canonicalAddress(data.parent);
    if (typeof src.$label === "string") {
      data.label = src.$label;
      data.headerTitle = src.$label;
    }
    if (typeof src.$subtitle === "string") {
      data.config = { ...data.config, subtitle: src.$subtitle };
    }
    if (typeof src.$outline === "boolean") {
      data.viewProps = { ...data.viewProps, outline: src.$outline };
    }
    if (["solid", "dashed", "dotted", "double"].includes(src.$borderStyle)) {
      data.viewProps = { ...data.viewProps, borderStyle: src.$borderStyle };
    }
    if (Number.isFinite(src.$borderWidth) && src.$borderWidth >= 0) {
      data.viewProps = { ...data.viewProps, borderWidth: src.$borderWidth };
    }
    if (Number.isFinite(src.$borderRadius) && src.$borderRadius >= 0) {
      data.viewProps = { ...data.viewProps, borderRadius: src.$borderRadius };
    }
    if (typeof src.$isNodeAnimated === "boolean") {
      data.isNodeAnimated = src.$isNodeAnimated;
    }
    if (["traveling", "pulse"].includes(src.$nodeAnimationVariant)) {
      data.nodeAnimationVariant = src.$nodeAnimationVariant;
    }
    if (typeof src.$content === "string") {
      data.config = { ...data.config, content: src.$content };
      if (!src.$view) data.type = "objectView";
    }
    if (
      data.config?.collapsed !== undefined ||
      src.$collapsed !== undefined ||
      src.$icon !== undefined
    ) {
      data.config = { ...(data.config || {}) };
      if (src.$collapsed !== undefined || data.config.collapsed !== undefined)
        data.config.collapsed = !!src.$collapsed;
      if (src.$icon !== undefined) data.config.icon = src.$icon;
    }
    return { data };
  });
  const seen = new Map<string, number>();
  const outEdges: FlowDiagramEdge[] = edges.map((e) => {
    let source = canonicalAddress(e.data.source);
    let target = canonicalAddress(e.data.target);
    let isInverted = e.data.isInverted;
    const originalOwner = resolveEdgeOwner(e.data);
    const side = centerSides.get(canonicalAddress(originalOwner.address));
    if (
      originalOwner.kind === "hierarchy" &&
      side !== undefined &&
      side !== !!isInverted
    ) {
      [source, target] = [target, source];
      isInverted = side;
    }
    const base = `${source}->${target}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const data: FlowDiagramEdge["data"] = {
      ...e.data,
      id: n ? `${base}#${n}` : base,
      source,
      target,
      isInverted,
    };
    const edgeOwner = resolveEdgeOwner(data);
    const owner = getNode(json, edgeOwner.address);
    if (owner && typeof owner === "object") {
      const type =
        owner[edgeOwner.kind === "target" ? "$targetEdgeType" : "$edgeType"];
      if (typeof type === "string") data.type = type;
      const icon =
        owner[edgeOwner.kind === "target" ? "$targetIcon" : "$edgeIcon"];
      if (typeof icon === "string") data.icon = icon;
      if (owner.$isEdgeAnimated !== undefined)
        data.isEdgeAnimated = !!owner.$isEdgeAnimated;
      const animationVariant =
        owner[
          edgeOwner.kind === "target"
            ? "$targetAnimationVariant"
            : "$edgeAnimationVariant"
        ];
      if (["dashed", "traveling"].includes(animationVariant))
        data.edgeAnimationVariant = animationVariant;
      if (owner.$isEdgeDashed !== undefined)
        data.isEdgeDashed = !!owner.$isEdgeDashed;
      if (owner.$edgeColor) data.color = owner.$edgeColor;
    }
    return { data };
  });
  if (!Array.isArray(json) && json?.$hideRoot === true) {
    const rootIndex = outNodes.findIndex((node) => node.data.id === ROOT);
    if (rootIndex !== -1) outNodes.splice(rootIndex, 1);
  }
  const nodeIds = new Set(outNodes.map((node) => node.data.id));
  for (let index = outEdges.length - 1; index >= 0; index--) {
    const data = outEdges[index].data;
    const owner = resolveEdgeOwner(data);
    if (
      !nodeIds.has(data.source) ||
      !nodeIds.has(data.target) ||
      (owner.kind === "hierarchy" &&
        getNode(json, owner.address)?.$hideParentEdge === true)
    )
      outEdges.splice(index, 1);
  }
  outEdges.push(
    ...prepared.edges.filter(
      (edge) => nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target),
    ),
  );
  const grouped = applyParentGroups(json, { nodes: outNodes, edges: outEdges });
  const collapsedPaths = grouped.nodes
    .filter((node) => node.data.config?.collapsed)
    .map((node) => addressToPath(node.data.id));
  if (!collapsedPaths.length) return grouped;
  const visibleNodes = grouped.nodes.filter((node) => {
    const path = addressToPath(node.data.id);
    return !collapsedPaths.some(
      (parent) =>
        parent.length < path.length &&
        parent.every((segment, index) => segment === path[index]),
    );
  });
  const visibleIds = new Set(visibleNodes.map((node) => node.data.id));
  return {
    nodes: visibleNodes,
    edges: grouped.edges.filter(
      (edge) =>
        visibleIds.has(edge.data.source) && visibleIds.has(edge.data.target),
    ),
  };
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
  const byId = new Map(nodes.map((node) => [node.data.id, node]));
  const parents = new Set(
    nodes.map((node) => node.data.parent).filter(Boolean),
  );
  const endpoints = new Map(
    nodes.map((node) => {
      let endpoint = node.data.id;
      let parent = node.data.parent;
      const seen = new Set([endpoint]);
      while (parent && !seen.has(parent)) {
        if (collapsed.has(parent)) endpoint = parent;
        seen.add(parent);
        parent = byId.get(parent)?.data.parent;
      }
      return [node.data.id, endpoint];
    }),
  );
  const out = new Map<string, string[]>();
  for (const e of edges) {
    const s = e.data.isInverted ? e.data.target : e.data.source;
    const t = e.data.isInverted ? e.data.source : e.data.target;
    (out.get(s) ?? out.set(s, []).get(s)!).push(t);
  }
  const hidden = new Set(
    nodes
      .filter((node) => endpoints.get(node.data.id) !== node.data.id)
      .map((node) => node.data.id),
  );
  for (const root of collapsed) {
    if (parents.has(root)) continue;
    const stack = [...(out.get(root) || [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (collapsed.has(id) || hidden.has(id)) continue;
      hidden.add(id);
      stack.push(...(out.get(id) || []));
    }
  }
  return {
    nodes: nodes
      .filter((node) => !hidden.has(node.data.id))
      .map((node) =>
        collapsed.has(node.data.id) && parents.has(node.data.id)
          ? {
              ...node,
              data: {
                ...node.data,
                type: "arrayView",
                label: node.data.label ?? node.data.headerTitle,
                config: {
                  ...node.data.config,
                  parentContainer: true,
                  labelBelow: true,
                  icon: node.data.config?.icon || "PiStack",
                },
              },
            }
          : node,
      ),
    edges: edges.flatMap((edge) => {
      const source = endpoints.get(edge.data.source) ?? edge.data.source;
      const target = endpoints.get(edge.data.target) ?? edge.data.target;
      if (hidden.has(source) || hidden.has(target)) return [];
      if (source === edge.data.source && target === edge.data.target)
        return [edge];
      if (source === target) return [];
      return [
        {
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
        },
      ];
    }),
  };
}
