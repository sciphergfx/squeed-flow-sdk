import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  EdgeMode,
  FlowDiagramConfig,
  FlowDiagramEdge,
  FlowEdgeProperties,
  NodeAlignment,
  NodeSelectionModifiers,
} from "../types";
import { animateTransition } from "./animation";
import { branchNodeIds } from "./branchNodeIds";
import { branchRoutes } from "./branchRouting";
import { resolveConfigPortRows } from "./configPortLayout";
import { connectedNodeIds } from "./connectedNodeIds";
import ContainerView, { type ContainerStyle } from "./ContainerView";
import { LABEL_FONT_SIZE, NODE_LABEL_FONT_SIZE } from "./edgeLabel";
import {
  NODE_CONNECTOR_CLEARANCE,
  PROPERTY_CONNECTOR_CLEARANCE,
} from "./edgeMetrics";
import { isEdgeVisible, isNodeVisible, visibleLayoutGraph } from "./edgeMode";
import EdgeView from "./EdgeView";
import type { TaxiDir } from "./geometry";
import { placeEdgeLabels } from "./labelPlacement";
import { computeContainers, runDagreLayout } from "./layout";
import {
  arrangeNodesInGrid,
  detectNodeCollisions,
  resolveNodeCollisions,
  type CollisionGeometry,
  type NodeGridOptions,
} from "./nodeCollisions";
import type { GridDivider } from "./nodeCollisions";
import { GridAdjustmentHandles } from "./GridAdjustmentHandles";
import NodeHost from "./NodeHost";
import { surfaceBox, type NodeSurface } from "./nodeSurface";
import type { PropertyRow } from "./propertyRows";
import { EDGE_LABEL_FONT_FAMILY, measureText } from "./text";
import {
  boxToRect,
  pointInRect,
  rectToBox,
  rectsIntersect,
  unionRects,
  type Box,
  type FlowEngine,
  type Point,
  type Rect,
  type ViewportState,
} from "./types";
import { useEdgeRevealSequence } from "./useEdgeRevealSequence";
import { Viewport } from "./viewport";

export interface CanvasNode {
  id: string;
  acceptsChildren?: boolean;
  collapsed?: boolean;
  hasCollapseControl?: boolean;
  parent?: string;
  /** Compound label drawn on the container (cytoscape `data(label)`) */
  label?: string;
  animated?: boolean;
  animationColor?: string;
  animationWidth?: number;
  animationVariant?: import("../types").NodeAnimationVariant;
  element: React.ReactNode;
  fillElement?: React.ReactNode;
}

export interface CanvasEdge extends FlowEdgeProperties {
  validationIssue?: string;
  id: string;
  data: FlowDiagramEdge["data"];
  type: string;
  source: string;
  target: string;
  label?: string;
  /** hex */
  color: string;
  connectorColor?: string;
  /** hex */
  labelBg: string;
  dashed: boolean;
  animated: boolean;
  inverted: boolean;
  /** taxi-turn fraction */
  turn: number;
}

export interface CanvasProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  direction: "LR" | "RL" | "TB" | "BT";
  nodeAlignment?: NodeAlignment;
  edgeMode?: EdgeMode;
  compactPropertyLayout?: boolean;
  edgeType?: FlowDiagramConfig["edgeType"];
  edgeRadius?: number;
  customEdgeTypes?: FlowDiagramConfig["customEdgeTypes"];
  edgeReveal?: FlowDiagramConfig["edgeReveal"];
  rankSep: number;
  edgeSep: number;
  spacingFactor?: number;
  compactSpacingScale?: number;
  layoutDebounce: number;
  isPerformanceMode: boolean;
  minZoom: number;
  maxZoom: number;
  initialViewport: ViewportState;
  fitOnInit?: boolean;
  animateViewport?: boolean;
  disableAnimations?: boolean;
  readOnly?: boolean;
  containerStyle: (id: string) => ContainerStyle & { padding: number };
  /** Ghost edge colour while drawing */
  lineColor: string;
  drawMode: boolean;
  drawHandles?: boolean;
  dragMode: boolean;
  multiSelect: boolean;
  onInit?: (engine: FlowEngine) => void;
  onLayoutComplete?: (engine: FlowEngine) => void;
  onNodeGridModeChange?: (options: NodeGridOptions | null) => void;
  onNodeGridZoomOut?: (options: NodeGridOptions) => boolean;
  onNodeGridDrop?: (
    nodeId: string,
    point: Point,
    modifiers?: import("../types").NodeSelectionModifiers,
  ) => boolean;
  onNodeParentChange?: (nodeId: string, parentId: string) => void;
  onViewportChange?: (vp: ViewportState) => void;
  onBackgroundTap?: () => void;
  onBoxSelect?: (ids: string[]) => void;
  onEdgeSelect?: (id: string) => void;
  onContainerSelect?: (id: string, modifiers?: NodeSelectionModifiers) => void;
  onContainerCollapse?: (id: string) => void;
  selectedNodeIds?: readonly string[];
  onEdgeDraw?: (
    sourceId: string,
    targetId: string,
    properties?: FlowEdgeProperties,
  ) => void;
  onDrawIntoSpace?: (
    sourceId: string,
    modelPos: Point,
    sourceProperty?: string,
    reverse?: boolean,
  ) => void;
}

const TAXI_DIR: Record<CanvasProps["direction"], TaxiDir> = {
  LR: "rightward",
  RL: "leftward",
  TB: "downward",
  BT: "upward",
};
const DEFAULT_SIZE = { w: 60, h: 60 };
const TAP_THRESHOLD = 4;
const DRAW_INTO_SPACE_THRESHOLD = 30;
const LAYOUT_SETTLE_MS = 500;
const CONTAINER_LABEL_BG_PADDING = 45;

type Size = { w: number; h: number };
type Gesture =
  | {
      kind: "pan";
      pointerId: number;
      start: Point;
      pan0: Point;
      moved: boolean;
    }
  | { kind: "tap"; pointerId: number; start: Point; moved: boolean }
  | { kind: "box"; pointerId: number; start: Point; current: Point }
  | {
      kind: "grid";
      pointerId: number;
      source: string;
      start: Point;
      moved: boolean;
    }
  | {
      kind: "draw";
      pointerId: number;
      source: string;
      sourceProperty?: string;
      reverse?: boolean;
      startClient: Point;
    }
  | { kind: "pinch"; distance: number; zoom: number; anchor: Point };

function measurePinch(pointers: Map<number, Point>) {
  const [first, second] = [...pointers.values()];
  if (!first || !second) return null;
  return {
    center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
  };
}

function Canvas(props: CanvasProps) {
  const {
    nodes,
    edges,
    direction,
    nodeAlignment = "center",
    edgeMode = "auto",
    compactPropertyLayout = false,
    rankSep,
    edgeSep,
    spacingFactor = 1.3,
    compactSpacingScale,
    minZoom,
    maxZoom,
    initialViewport,
    containerStyle,
    lineColor,
    drawMode,
    dragMode,
    multiSelect,
    isPerformanceMode,
    disableAnimations = false,
  } = props;

  const [isolation, setIsolation] = useState<{
    id: string;
    mode: "connections" | "branch";
  } | null>(null);
  const isolatedIds = useMemo(
    () =>
      isolation
        ? (isolation.mode === "connections" ? connectedNodeIds : branchNodeIds)(
            isolation.id,
            nodes,
            edges,
          )
        : null,
    [isolation, nodes, edges],
  );
  const propertyMode = edgeMode === "auto" || edgeMode === "properties";
  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (edge) =>
          isEdgeVisible(edge, edgeMode) &&
          (!isolatedIds ||
            (isolatedIds.has(edge.source) && isolatedIds.has(edge.target))),
      ),
    [edges, edgeMode, isolatedIds],
  );
  const layoutGraph = useMemo(
    () =>
      visibleLayoutGraph(
        nodes,
        edges,
        edgeMode,
        compactPropertyLayout,
        isolatedIds,
      ),
    [nodes, edges, edgeMode, compactPropertyLayout, isolatedIds],
  );
  const layoutGraphRef = useRef(layoutGraph);
  layoutGraphRef.current = layoutGraph;
  const propsRef = useRef(props);
  propsRef.current = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const svgGroupRef = useRef<SVGGElement>(null);
  const labelGroupRef = useRef<SVGGElement>(null);
  const nodesLayerRef = useRef<HTMLDivElement>(null);

  const viewport = useMemo(
    () => new Viewport(initialViewport, minZoom, maxZoom),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    viewport.minZoom = minZoom;
    viewport.maxZoom = maxZoom;
  }, [viewport, minZoom, maxZoom]);
  useLayoutEffect(() => {
    viewport.setAnimationsDisabled(disableAnimations);
  }, [viewport, disableAnimations]);

  // ── node sizes (ResizeObserver over the DOM hosts) ──
  const sizesRef = useRef(new Map<string, Size>());
  const elByIdRef = useRef(new Map<string, HTMLDivElement>());
  const idByElRef = useRef(new Map<Element, string>());
  const roRef = useRef<ResizeObserver | null>(null);
  const [nodeSurfaces, setNodeSurfaces] = useState(
    new Map<string, NodeSurface>(),
  );
  const onSurface = useCallback(
    (id: string, surface: NodeSurface | undefined) => {
      setNodeSurfaces((current) => {
        if (JSON.stringify(current.get(id)) === JSON.stringify(surface))
          return current;
        const next = new Map(current);
        if (surface) next.set(id, surface);
        else next.delete(id);
        return next;
      });
    },
    [],
  );
  const [propertyRows, setPropertyRows] = useState(
    new Map<string, PropertyRow[]>(),
  );
  const propertyRowsRef = useRef(propertyRows);
  const onPropertyRows = useCallback((id: string, rows: PropertyRow[]) => {
    setPropertyRows((current) => {
      if (JSON.stringify(current.get(id) ?? []) === JSON.stringify(rows))
        return current;
      const next = new Map(current);
      if (rows.length) next.set(id, rows);
      else next.delete(id);
      return next;
    });
  }, []);

  // ── positions ──
  const [positions, setPositions] = useState<Map<string, Point>>(
    () => new Map(),
  );
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const [gridSizes, setGridSizes] = useState(new Map<string, Size>());
  const gridSizesRef = useRef(gridSizes);
  const clearGridSizes = () => {
    gridSizesRef.current = new Map();
    setGridSizes(gridSizesRef.current);
  };
  const placedNodes = useRef(new Map<string, Point>());
  const resizeAnchor = useRef<{ id: string; position: Point } | null>(null);
  const hasLayoutRunRef = useRef(false);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const settleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const animRef = useRef<(() => void) | null>(null);
  const pendingFitRef = useRef(false);
  const pendingLayoutAction = useRef<(() => void) | null>(null);
  const geometryFocus = useRef<
    ((positions?: Map<string, Point>) => void) | null
  >(null);
  const previousSpacingFactor = useRef(spacingFactor);
  const compactLayout = compactPropertyLayout;
  const previousCompactLayout = useRef(compactLayout);
  const [edgesVisible, setEdgesVisible] = useState(true);
  const [nodeGridMode, setNodeGridMode] = useState(false);
  const [gridDividers, setGridDividers] = useState<GridDivider[]>([]);
  const nodeGridRef = useRef<{
    options: NodeGridOptions;
    order: string[];
    previousPositions: Map<string, Point>;
    previousViewport: ViewportState;
    previousSize: Size;
    ready: boolean;
  } | null>(null);
  const [gridDrag, setGridDrag] = useState<{
    source: string;
    offset: Point;
    target: string | null;
    shiftKey: boolean;
  } | null>(null);
  const isolatedIdsRef = useRef<Set<string> | null>(null);
  isolatedIdsRef.current = isolatedIds;
  const connectionSpacingRef = useRef(1);
  connectionSpacingRef.current = isolation?.mode === "connections" ? 1.25 : 1;
  const savedViewport = useRef<ViewportState | null>(null);
  const previousNodes = useRef(nodes);
  const revealedNodes = useRef<string[]>([]);
  const centerRevealed = useRef(false);

  const cancelAnim = () => {
    animRef.current?.();
    animRef.current = null;
  };

  const onLayoutStop = () => {
    geometryFocus.current = null;
    if (revealedNodes.current.length) centerRevealed.current = true;
    if (!hasLayoutRunRef.current && propsRef.current.fitOnInit !== false)
      pendingFitRef.current = true;
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      hasLayoutRunRef.current = positionsRef.current.size > 0;
      setLayoutRevision((revision) => revision + 1);
    }, LAYOUT_SETTLE_MS);
  };

  const animateTo = (
    target: Map<string, Point>,
    animate: boolean,
    updateViewport?: (progress: number) => void,
    complete = onLayoutStop,
    targetSizes?: Map<string, Size>,
  ) => {
    cancelAnim();
    const from = new Map(positionsRef.current);
    const fromSizes = new Map([...sizesRef.current, ...gridSizesRef.current]);
    animRef.current = animateTransition(
      animate,
      (progress) => {
        const next = new Map<string, Point>();
        target.forEach((position, id) => {
          const previous = from.get(id);
          next.set(
            id,
            previous
              ? {
                  x: previous.x + (position.x - previous.x) * progress,
                  y: previous.y + (position.y - previous.y) * progress,
                }
              : position,
          );
        });
        positionsRef.current = next;
        setPositions(next);
        if (targetSizes) {
          const sizes = new Map<string, Size>();
          for (const [id, size] of targetSizes) {
            const previous = fromSizes.get(id) ?? size;
            sizes.set(id, {
              w: previous.w + (size.w - previous.w) * progress,
              h: previous.h + (size.h - previous.h) * progress,
            });
          }
          gridSizesRef.current = sizes;
          setGridSizes(sizes);
        }
        updateViewport?.(progress);
      },
      complete,
    );
  };

  const runLayoutNow = () => {
    clearTimeout(layoutTimerRef.current);
    if (nodeGridRef.current) {
      engine.arrangeNodesInGrid(nodeGridRef.current.options);
      return;
    }
    if (gridSizesRef.current.size) clearGridSizes();
    const p = propsRef.current;
    const connectionSpacing = connectionSpacingRef.current;
    const graph = layoutGraphRef.current;
    const inputs = graph.nodes.map((n) => {
      const host = elByIdRef.current.get(n.id);
      if (host && (host.offsetWidth || host.offsetHeight))
        sizesRef.current.set(n.id, {
          w: host.offsetWidth,
          h: host.offsetHeight,
        });
      const s = sizesRef.current.get(n.id) || DEFAULT_SIZE;
      return { id: n.id, parent: n.parent, width: s.w, height: s.h };
    });
    let target: Map<string, Point>;
    try {
      const compact = p.compactPropertyLayout;
      const propertyMode = p.edgeMode !== "nodes" && p.edgeMode !== "workflow";
      const layoutEdges = graph.edges.map((edge) => ({
        ...edge,
        connectorClearance: !compact
          ? 0
          : propertyMode &&
              (edge.sourceProperty !== undefined ||
                edge.targetProperty !== undefined)
            ? PROPERTY_CONNECTOR_CLEARANCE
            : NODE_CONNECTOR_CLEARANCE,
      }));
      target = runDagreLayout(inputs, layoutEdges, {
        edgeLabelFontSize:
          p.edgeMode === "nodes" || p.edgeMode === "workflow"
            ? NODE_LABEL_FONT_SIZE
            : LABEL_FONT_SIZE,
        rankDir: p.direction,
        compact,
        nodeAlignment: p.nodeAlignment,
        rankSep: p.rankSep * connectionSpacing,
        edgeSep: p.edgeSep * connectionSpacing,
        nodeSep: 5 * connectionSpacing,
        spacingFactor: p.spacingFactor ?? 1.3,
        compactSpacingScale:
          (p.compactSpacingScale ?? (p.spacingFactor ?? 1.3) / 1.3) *
          connectionSpacing,
      });
    } catch (err) {
      console.warn("[flow-sdk] layout failed", err);
      return;
    }
    const anchor = resizeAnchor.current;
    resizeAnchor.current = null;
    const anchorTarget = anchor && target.get(anchor.id);
    if (anchor && anchorTarget) {
      const offset = {
        x: anchor.position.x - anchorTarget.x,
        y: anchor.position.y - anchorTarget.y,
      };
      target = new Map(
        [...target].map(([id, position]) => [
          id,
          { x: position.x + offset.x, y: position.y + offset.y },
        ]),
      );
    }
    for (const [id, position] of placedNodes.current) {
      if (target.has(id)) target.set(id, position);
      else if (!p.nodes.some((node) => node.id === id))
        placedNodes.current.delete(id);
    }
    const updateViewport = viewport.coordinate(() =>
      geometryFocus.current?.(target),
    );
    animateTo(
      target,
      hasLayoutRunRef.current && !p.isPerformanceMode && !p.disableAnimations,
      updateViewport,
    );
  };

  const scheduleLayout = useCallback(() => {
    clearTimeout(settleTimerRef.current);
    clearTimeout(layoutTimerRef.current);
    layoutTimerRef.current = setTimeout(
      runLayoutNow,
      propsRef.current.layoutDebounce,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const previous = new Map(
      previousNodes.current.map((node) => [node.id, node]),
    );
    if (
      nodes.some(
        (node) => previous.get(node.id)?.collapsed === true && !node.collapsed,
      )
    ) {
      revealedNodes.current = nodes
        .filter((node) => !previous.has(node.id))
        .map((node) => node.id);
    }
    previousNodes.current = nodes;
    if (
      previousSpacingFactor.current !== spacingFactor &&
      positionsRef.current.size > 0
    ) {
      hasLayoutRunRef.current = true;
      pendingFitRef.current = false;
      clearTimeout(settleTimerRef.current);
    }
    previousSpacingFactor.current = spacingFactor;
    if (previousCompactLayout.current !== compactLayout)
      pendingFitRef.current = !pendingLayoutAction.current;
    previousCompactLayout.current = compactLayout;
    if (geometryFocus.current && !pendingLayoutAction.current) {
      clearTimeout(layoutTimerRef.current);
      runLayoutNow();
    } else scheduleLayout();
  }, [
    nodes,
    edges,
    layoutGraph.nodes,
    layoutGraph.edges,
    compactLayout,
    direction,
    nodeAlignment,
    rankSep,
    edgeSep,
    scheduleLayout,
    spacingFactor,
    compactSpacingScale,
    disableAnimations,
  ]);

  useEffect(
    () => () => {
      clearTimeout(layoutTimerRef.current);
      clearTimeout(settleTimerRef.current);
      cancelAnim();
    },
    [],
  );

  const onHostMount = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (!roRef.current && typeof ResizeObserver !== "undefined") {
        roRef.current = new ResizeObserver((entries) => {
          let changed = false;
          for (const entry of entries) {
            const nid = idByElRef.current.get(entry.target);
            if (!nid) continue;
            if (gridSizesRef.current.has(nid)) continue;
            const t = entry.target as HTMLElement;
            const w = t.offsetWidth;
            const h = t.offsetHeight;
            if (!w && !h) continue;
            const prev = sizesRef.current.get(nid);
            if (prev && prev.w === w && prev.h === h) continue;
            const position = positionsRef.current.get(nid);
            if (
              prev &&
              position &&
              hasLayoutRunRef.current &&
              !resizeAnchor.current
            )
              resizeAnchor.current = { id: nid, position: { ...position } };
            sizesRef.current.set(nid, { w, h });
            changed = true;
          }
          if (changed) {
            if (geometryFocus.current && !pendingLayoutAction.current)
              runLayoutNow();
            else scheduleLayout();
          }
        });
      }
      if (el) {
        elByIdRef.current.set(id, el);
        idByElRef.current.set(el, id);
        roRef.current?.observe(el);
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (!gridSizesRef.current.has(id) && (w || h))
          sizesRef.current.set(id, { w, h });
      } else {
        const prev = elByIdRef.current.get(id);
        if (prev) {
          roRef.current?.unobserve(prev);
          idByElRef.current.delete(prev);
        }
        elByIdRef.current.delete(id);
        sizesRef.current.delete(id);
        if (propertyRowsRef.current.has(id)) onPropertyRows(id, []);
      }
      scheduleLayout();
    },
    [scheduleLayout, onPropertyRows],
  );

  useEffect(() => () => roRef.current?.disconnect(), []);

  // ── derived geometry ──
  const containerMinSize = (id: string) => {
    const label = propsRef.current.nodes.find((node) => node.id === id)?.label;
    if (!label) return undefined;
    const style = propsRef.current.containerStyle(id);
    return {
      w:
        measureText(
          label,
          `bold ${style.fontSize}px ${EDGE_LABEL_FONT_FAMILY}`,
        ) +
        2 * CONTAINER_LABEL_BG_PADDING,
      h: 0,
    };
  };
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) if (n.label) m.set(n.id, n.label);
    return m;
  }, [nodes]);

  const containers = useMemo(
    () =>
      computeContainers(
        layoutGraph.nodes,
        positions,
        new Map([...sizesRef.current, ...gridSizes]),
        (id) => containerStyle(id).padding,
        containerMinSize,
      ),
    [layoutGraph.nodes, positions, containerStyle, labelById, gridSizes],
  );
  const containersRef = useRef(containers);
  containersRef.current = containers;

  const boxFor = useCallback((id: string): Box | undefined => {
    const r = containersRef.current.get(id);
    if (r) return rectToBox(r);
    const p = positionsRef.current.get(id);
    if (!p) return undefined;
    const s =
      gridSizesRef.current.get(id) || sizesRef.current.get(id) || DEFAULT_SIZE;
    return { x: p.x, y: p.y, w: s.w, h: s.h };
  }, []);

  const resolvedPropertyRows = useMemo(() => {
    const boxes = new Map<string, Box>();
    for (const node of nodes) {
      const box = boxFor(node.id);
      if (box) boxes.set(node.id, box);
    }
    return resolveConfigPortRows(
      propertyRows,
      boxes,
      nodeSurfaces,
      edges,
      direction,
    );
  }, [
    propertyRows,
    nodes,
    positions,
    containers,
    nodeSurfaces,
    edges,
    direction,
    boxFor,
  ]);
  propertyRowsRef.current = resolvedPropertyRows;

  const propertyY = (id: string, property?: string): number | undefined => {
    if (!propertyMode || property === undefined) return undefined;
    const row = resolvedPropertyRows
      .get(id)
      ?.find((row) => row.property === property);
    const box = boxFor(id);
    return row && !row.anchor && box
      ? box.y - box.h / 2 + row.top + row.height / 2
      : undefined;
  };

  const portFor = (id: string, property?: string) => {
    if (property === undefined) return;
    const anchor = resolvedPropertyRows
      .get(id)
      ?.find((row) => row.property === property)?.anchor;
    const box = boxFor(id);
    return anchor && box
      ? {
          x: box.x - box.w / 2 + anchor.x,
          y: box.y - box.h / 2 + anchor.y,
          side: anchor.side,
        }
      : undefined;
  };

  const edgeBoxFor = (id: string, property?: string): Box | undefined => {
    const box = boxFor(id);
    const surface = nodeSurfaces.get(id);
    return box &&
      surface &&
      !containers.has(id) &&
      propertyY(id, property) === undefined
      ? surfaceBox(box, surface)
      : box;
  };

  const elementsBBox = (): Rect | null => {
    const rects: Rect[] = [];
    positionsRef.current.forEach((p, id) => {
      if (containersRef.current.has(id)) return;
      const s = sizesRef.current.get(id) || DEFAULT_SIZE;
      rects.push(boxToRect({ x: p.x, y: p.y, w: s.w, h: s.h }));
    });
    containersRef.current.forEach((r) => rects.push(r));
    try {
      for (const group of [svgGroupRef.current, labelGroupRef.current]) {
        const bb = group?.getBBox();
        if (bb && bb.width > 0 && bb.height > 0)
          rects.push({
            x1: bb.x,
            y1: bb.y,
            x2: bb.x + bb.width,
            y2: bb.y + bb.height,
          });
      }
    } catch {
      /* detached svg */
    }
    return unionRects(rects);
  };

  // ── viewport → DOM ──
  const applyTransform = () => {
    const { pan, zoom } = viewport;
    if (nodesLayerRef.current)
      nodesLayerRef.current.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`;
    svgGroupRef.current?.setAttribute(
      "transform",
      `translate(${pan.x} ${pan.y}) scale(${zoom})`,
    );
    labelGroupRef.current?.setAttribute(
      "transform",
      `translate(${pan.x} ${pan.y}) scale(${zoom})`,
    );
  };

  useEffect(() => {
    applyTransform();
    let rafId: number | null = null;
    let busyTimer: ReturnType<typeof setTimeout> | undefined;
    const off = viewport.onChange(() => {
      applyTransform();
      const root = rootRef.current;
      if (root) {
        root.classList.add("flow-sdk-busy");
        clearTimeout(busyTimer);
        busyTimer = setTimeout(
          () => root.classList.remove("flow-sdk-busy"),
          150,
        );
      }
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        propsRef.current.onViewportChange?.(viewport.state);
      });
    });
    return () => {
      off();
      clearTimeout(busyTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Container size (falls back like the previous Graph when the parent has no height)
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      if (!root.getClientRects().length) return;
      let w = root.clientWidth;
      let h = root.clientHeight;
      if (!h) {
        h = Math.max(
          0,
          window.innerHeight - root.getBoundingClientRect().top - 100,
        );
        if (h) root.style.height = `${h}px`;
      }
      if (!w) {
        w = window.innerWidth;
        if (w) root.style.width = `${w}px`;
      }
      const resized = viewport.size.w !== w || viewport.size.h !== h;
      viewport.size = { w, h };
      if (resized && nodeGridRef.current?.options.fill) scheduleLayout();
      if (
        !hasLayoutRunRef.current &&
        !positionsRef.current.size &&
        propsRef.current.fitOnInit !== false
      ) {
        viewport.set({ x: w / 2, y: h / 2 });
        applyTransform();
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [viewport]);

  useLayoutEffect(() => {
    if (centerRevealed.current) {
      centerRevealed.current = false;
      const boxes = revealedNodes.current.flatMap((id) => {
        const box = boxFor(id);
        return box ? [boxToRect(box)] : [];
      });
      revealedNodes.current = [];
      const bounds = unionRects(boxes);
      if (bounds) {
        pendingFitRef.current = false;
        viewport.center(bounds, propsRef.current.animateViewport);
        return;
      }
    }
    if (!pendingFitRef.current) return;
    pendingFitRef.current = false;
    const bb = elementsBBox();
    if (bb) {
      viewport.fit(
        bb,
        50,
        hasLayoutRunRef.current && propsRef.current.animateViewport,
      );
      if (!hasLayoutRunRef.current) applyTransform();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  // ── engine handle ──
  const engine = useMemo<FlowEngine>(() => {
    const collisionGeometry = (): CollisionGeometry => {
      const current = propsRef.current;
      const visibleNodes = layoutGraphRef.current.nodes.filter(
        (node) =>
          isNodeVisible(node.id, current.edges, current.edgeMode) &&
          (!isolatedIdsRef.current || isolatedIdsRef.current.has(node.id)),
      );
      return {
        nodes: visibleNodes,
        positions: positionsRef.current,
        sizes: new Map(
          visibleNodes.map((node) => [
            node.id,
            sizesRef.current.get(node.id) ?? DEFAULT_SIZE,
          ]),
        ),
        padding: (id) => propsRef.current.containerStyle(id).padding,
        minSize: containerMinSize,
        fixedIds: new Set(placedNodes.current.keys()),
        viewportSize: { ...viewport.size },
      };
    };
    const branchIds = (id: string) =>
      branchNodeIds(id, propsRef.current.nodes, propsRef.current.edges);
    const applyPositionTarget = (
      target: Map<string, Point>,
      animate = true,
      complete = () => {},
      viewportAction?: (animate: boolean) => void,
      targetSizes?: Map<string, Size>,
      preserveFocus = false,
    ) => {
      clearTimeout(layoutTimerRef.current);
      clearTimeout(settleTimerRef.current);
      if (!preserveFocus) geometryFocus.current = null;
      pendingLayoutAction.current = null;
      pendingFitRef.current = false;
      revealedNodes.current = [];
      centerRevealed.current = false;
      viewport.cancelAnimation();
      const enabled =
        animate &&
        !propsRef.current.isPerformanceMode &&
        !propsRef.current.disableAnimations;
      const updateViewport = viewport.coordinate(() => {
        if (viewportAction) viewportAction(enabled);
        else if (preserveFocus) geometryFocus.current?.(target);
      });
      animateTo(
        new Map([...target].map(([id, position]) => [id, { ...position }])),
        enabled,
        updateViewport,
        complete,
        targetSizes,
      );
    };
    const focus = (
      ids: Set<string> | undefined,
      padding = 50,
      animate = propsRef.current.animateViewport,
      zoomScale = 1,
      afterViewChange = false,
    ) => {
      const applyFocus = (positions?: Map<string, Point>) => {
        const graph = layoutGraphRef.current;
        const targetIds = ids ?? new Set(graph.nodes.map((node) => node.id));
        const parents = new Set(
          graph.nodes.map((node) => node.parent).filter(Boolean),
        );
        if (!positions && (!ids || [...ids].some((id) => parents.has(id))))
          return;
        const targetContainers =
          positions &&
          computeContainers(
            graph.nodes,
            positions,
            sizesRef.current,
            (id) => propsRef.current.containerStyle(id).padding,
            containerMinSize,
          );
        const bounds = unionRects(
          [...targetIds].flatMap((id) => {
            const container = targetContainers?.get(id);
            if (container) return [container];
            const position = positions?.get(id);
            const size = sizesRef.current.get(id) || DEFAULT_SIZE;
            const box = position ? { ...position, ...size } : boxFor(id);
            return box ? [boxToRect(box)] : [];
          }),
        );
        if (!bounds) return;
        pendingFitRef.current = false;
        revealedNodes.current = [];
        centerRevealed.current = false;
        viewport.fit(
          bounds,
          Number.isFinite(padding) ? Math.max(0, padding) : 50,
          animate,
          zoomScale,
        );
      };
      geometryFocus.current = afterViewChange ? applyFocus : null;
      if (!afterViewChange) applyFocus(positionsRef.current);
    };
    const isolate = (
      id: string,
      mode: "connections" | "branch",
      padding?: number,
      animate?: boolean,
    ) => {
      if (!boxFor(id)) return;
      const ids = mode === "connections" ? connections(id) : branchIds(id);
      if (
        mode === "connections" &&
        connectionSpacingRef.current === 1.25 &&
        isolatedIdsRef.current?.size === ids.size &&
        [...ids].every((nodeId) => isolatedIdsRef.current!.has(nodeId))
      ) {
        setIsolation({ id, mode });
        return;
      }
      if (!savedViewport.current)
        savedViewport.current = {
          pan: { ...viewport.pan },
          zoom: viewport.zoom,
        };
      isolatedIdsRef.current = ids;
      if (propsRef.current.compactPropertyLayout) {
        pendingFitRef.current = false;
        pendingLayoutAction.current = () =>
          focus(isolatedIdsRef.current ?? ids, padding, animate);
      }
      setIsolation({ id, mode });
      if (!propsRef.current.compactPropertyLayout) focus(ids, padding, animate);
    };
    const updateViewport = (action: () => void) => {
      if (pendingLayoutAction.current) pendingLayoutAction.current = action;
      else action();
    };
    const connections = (id: string) =>
      connectedNodeIds(id, propsRef.current.nodes, propsRef.current.edges);
    const zoom = ((level?: number) => {
      if (level === undefined) return viewport.zoom;
      if (
        level < viewport.zoom &&
        nodeGridRef.current?.options.fill &&
        !propsRef.current.readOnly &&
        propsRef.current.onNodeGridZoomOut?.(nodeGridRef.current.options) ===
          true
      )
        return;
      geometryFocus.current = null;
      viewport.set(undefined, level);
    }) as FlowEngine["zoom"];
    const pan = ((p?: Point) => {
      if (p === undefined) return viewport.pan;
      geometryFocus.current = null;
      viewport.set(p);
    }) as FlowEngine["pan"];
    const rendered = (clientX: number, clientY: number): Point => {
      const r = rootRef.current?.getBoundingClientRect();
      return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
    };
    const fit = (
      padding = 0,
      animate = propsRef.current.animateViewport,
      afterViewChange = false,
    ) => {
      if (afterViewChange) {
        focus(undefined, padding, animate, 1, true);
        return;
      }
      geometryFocus.current = null;
      updateViewport(() => {
        const bounds = elementsBBox();
        if (bounds) viewport.fit(bounds, padding, animate);
      });
    };
    return {
      zoom,
      pan,
      setEdgesVisible,
      focusNode: (id, padding, animate, afterViewChange) =>
        updateViewport(() =>
          focus(new Set([id]), padding, animate, 0.6, afterViewChange),
        ),
      focusBranch: (id, padding, animate) =>
        updateViewport(() => focus(branchIds(id), padding, animate)),
      focusConnections: (id, padding, animate, afterViewChange) =>
        updateViewport(() =>
          focus(connections(id), padding, animate, 1, afterViewChange),
        ),
      isolateConnections: (id, padding, animate) =>
        isolate(id, "connections", padding, animate),
      isolateBranch: (id, padding, animate) =>
        isolate(id, "branch", padding, animate),
      restoreView: (animate = propsRef.current.animateViewport, state) => {
        geometryFocus.current = null;
        const needsLayout =
          propsRef.current.compactPropertyLayout && !!isolatedIdsRef.current;
        isolatedIdsRef.current = null;
        setIsolation(null);
        const previous = state ?? savedViewport.current;
        savedViewport.current = null;
        if (needsLayout)
          pendingLayoutAction.current = () => {
            if (previous) viewport.transition(previous, animate);
          };
        else if (previous)
          updateViewport(() => viewport.transition(previous, animate));
      },
      zoomAt: (level, pt) => {
        if (
          level < viewport.zoom &&
          nodeGridRef.current?.options.fill &&
          !propsRef.current.readOnly &&
          propsRef.current.onNodeGridZoomOut?.(nodeGridRef.current.options) ===
            true
        )
          return;
        geometryFocus.current = null;
        viewport.zoomAt(level, pt);
      },
      fit,
      centerAndFit: fit,
      center: (animate = propsRef.current.animateViewport) => {
        geometryFocus.current = null;
        const bb = elementsBBox();
        if (bb) viewport.center(bb, animate);
      },
      clientToModel: (cx, cy) => viewport.renderedToModel(rendered(cx, cy)),
      modelToClient: (p) => {
        const r = rootRef.current?.getBoundingClientRect();
        const v = viewport.modelToRendered(p);
        return { x: v.x + (r?.left ?? 0), y: v.y + (r?.top ?? 0) };
      },
      getNodeBox: (id) => boxFor(id),
      detectNodeCollisions: (options) => {
        const geometry = collisionGeometry();
        return detectNodeCollisions(
          {
            ...geometry,
            sizes: new Map([...geometry.sizes, ...gridSizesRef.current]),
          },
          options,
        );
      },
      resolveNodeCollisions: (options = {}) => {
        const result = resolveNodeCollisions(collisionGeometry(), options);
        if (!result.movedNodeIds.length) return result;
        applyPositionTarget(result.positions, options.animate);
        return result;
      },
      arrangeNodesInGrid: (options = {}) => {
        const geometry = collisionGeometry();
        const grid = nodeGridRef.current;
        if (grid) {
          geometry.positions = new Map(geometry.positions);
          for (const node of geometry.nodes) {
            if (!geometry.positions.has(node.id))
              geometry.positions.set(
                node.id,
                viewport.renderedToModel({
                  x: viewport.size.w / 2,
                  y: viewport.size.h / 2,
                }),
              );
          }
          const ids = new Set(geometry.nodes.map((node) => node.id));
          grid.order = grid.order.filter((id) => ids.has(id));
          const known = new Set(grid.order);
          grid.order.push(
            ...geometry.nodes
              .filter((node) => !known.has(node.id))
              .map((node) => node.id),
          );
          const order = new Map(grid.order.map((id, index) => [id, index]));
          geometry.nodes = [...geometry.nodes].sort(
            (first, second) => order.get(first.id)! - order.get(second.id)!,
          );
        }
        const result = arrangeNodesInGrid(geometry, options);
        setGridDividers(result.dividers ?? []);
        if (grid) {
          grid.ready = false;
        }
        const complete = () => {
          if (grid) grid.ready = true;
        };
        if (!result.sizes && gridSizesRef.current.size) clearGridSizes();
        if (
          result.movedNodeIds.length ||
          result.bounds ||
          geometryFocus.current
        )
          applyPositionTarget(
            result.positions,
            options.animate,
            complete,
            result.bounds && (!grid || !gridSizesRef.current.size)
              ? () =>
                  viewport.transition({ zoom: 1, pan: { x: 0, y: 0 } }, false)
              : undefined,
            result.sizes,
            !!grid && !result.bounds,
          );
        else complete();
        return result;
      },
      setNodeGridMode: (enabled, options = {}) => {
        if (
          options.order &&
          (!Array.isArray(options.order) ||
            options.order.some((id) => typeof id !== "string") ||
            new Set(options.order).size !== options.order.length)
        )
          throw new Error("Invalid grid node order.");
        if (enabled) {
          arrangeNodesInGrid(collisionGeometry(), options);
          if (
            !nodeGridRef.current ||
            (nodeGridRef.current.options.fill && !options.fill)
          )
            geometryFocus.current = null;
          else geometryFocus.current = null;
          if (!nodeGridRef.current) {
            nodeGridRef.current = {
              options,
              order: collisionGeometry().nodes.map((node) => node.id),
              previousPositions: new Map(
                [...positionsRef.current].map(([id, position]) => [
                  id,
                  { ...position },
                ]),
              ),
              previousViewport: {
                zoom: viewport.zoom,
                pan: { ...viewport.pan },
              },
              previousSize: { ...viewport.size },
              ready: false,
            };
          }
          if (
            !nodeGridRef.current.ready ||
            (nodeGridRef.current.options.fill && !options.fill)
          )
            engine.centerAndFit(80, options.animate, true);
          if (options.order) nodeGridRef.current.order = [...options.order];
          nodeGridRef.current.options = { ...options };
          setNodeGridMode(true);
          engine.arrangeNodesInGrid(options);
          propsRef.current.onNodeGridModeChange?.({
            ...options,
            order: [...nodeGridRef.current.order],
          });
        } else {
          const grid = nodeGridRef.current;
          if (!grid) return;
          const restoreViewport =
            viewport.size.w === grid.previousSize.w &&
            viewport.size.h === grid.previousSize.h &&
            positionsRef.current.size === grid.previousPositions.size &&
            [...positionsRef.current.keys()].every((id) =>
              grid.previousPositions.has(id),
            );
          if (!restoreViewport) engine.centerAndFit(80, options.animate, true);
          nodeGridRef.current = null;
          setNodeGridMode(false);
          clearGridSizes();
          propsRef.current.onNodeGridModeChange?.(null);
          setGridDrag(null);
          const target = new Map(
            [...positionsRef.current].map(([id, position]) => [
              id,
              grid.previousPositions.get(id) ?? position,
            ]),
          );
          applyPositionTarget(
            target,
            options.animate,
            undefined,
            restoreViewport
              ? (animate) => viewport.transition(grid.previousViewport, animate)
              : undefined,
            undefined,
            !restoreViewport,
          );
        }
      },
      swapGridNodes: (source, target, animate) => {
        const grid = nodeGridRef.current;
        if (
          !grid ||
          !grid.ready ||
          propsRef.current.readOnly ||
          source === target
        )
          return false;
        const geometry = collisionGeometry();
        const first = geometry.nodes.find((node) => node.id === source);
        const second = geometry.nodes.find((node) => node.id === target);
        if (!first || !second || first.parent !== second.parent) return false;
        const result = arrangeNodesInGrid(geometry, grid.options);
        if (
          result.skippedNodeIds.includes(source) ||
          result.skippedNodeIds.includes(target)
        )
          return false;
        const sourceIndex = grid.order.indexOf(source);
        const targetIndex = grid.order.indexOf(target);
        if (sourceIndex < 0 || targetIndex < 0) return false;
        [grid.order[sourceIndex], grid.order[targetIndex]] = [
          grid.order[targetIndex],
          grid.order[sourceIndex],
        ];
        geometryFocus.current = null;
        grid.options = { ...grid.options, order: [...grid.order] };
        engine.arrangeNodesInGrid({
          ...grid.options,
          animate: animate ?? grid.options.animate,
        });
        propsRef.current.onNodeGridModeChange?.({ ...grid.options });
        return true;
      },
      setNodePosition: (id, position, options) => {
        if (!positionsRef.current.has(id)) return false;
        if (
          position &&
          (!Number.isFinite(position.x) || !Number.isFinite(position.y))
        )
          return false;
        cancelAnim();
        if (!position) {
          placedNodes.current.delete(id);
          scheduleLayout();
          return true;
        }
        const next = new Map(positionsRef.current);
        next.set(id, { ...position });
        if (options?.persist === false) placedNodes.current.delete(id);
        else placedNodes.current.set(id, { ...position });
        positionsRef.current = next;
        setPositions(next);
        if (options?.persist === false) scheduleLayout();
        return true;
      },
      onViewportChange: (fn) => viewport.onChange(fn),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    propsRef.current.onInit?.(engine);
    return () => viewport.cancelAnimation();
  }, [engine]);
  useEffect(() => {
    if (layoutRevision > 0) {
      const action = pendingLayoutAction.current;
      pendingLayoutAction.current = null;
      action?.();
      propsRef.current.onLayoutComplete?.(engine);
    }
  }, [engine, layoutRevision]);

  // ── pointer interaction on the background ──
  const gestureRef = useRef<Gesture | null>(null);
  const touchesRef = useRef(new Map<number, Point>());
  const suppressClickRef = useRef(false);
  const [boxRect, setBoxRect] = useState<Rect | null>(null);
  const [ghost, setGhost] = useState<{
    source: string;
    sourceProperty?: string;
    point: Point;
    target: string | null;
    targetProperty?: string;
  } | null>(null);

  const toRendered = (e: { clientX: number; clientY: number }): Point => {
    const r = rootRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (rootRef.current!.clientWidth / r.width || 1),
      y: (e.clientY - r.top) * (rootRef.current!.clientHeight / r.height || 1),
    };
  };

  const hitTestNode = (model: Point, exclude?: string): string | null => {
    const list = propsRef.current.nodes;
    for (let i = list.length - 1; i >= 0; i--) {
      const id = list[i].id;
      if (!isNodeVisible(id, propsRef.current.edges, propsRef.current.edgeMode))
        continue;
      if (isolatedIdsRef.current && !isolatedIdsRef.current.has(id)) continue;
      if (id === exclude || containersRef.current.has(id)) continue;
      const b = boxFor(id);
      if (b && pointInRect(model, boxToRect(b))) return id;
    }
    for (const [id, r] of containersRef.current) {
      if (!isNodeVisible(id, propsRef.current.edges, propsRef.current.edgeMode))
        continue;
      if (isolatedIdsRef.current && !isolatedIdsRef.current.has(id)) continue;
      if (id !== exclude && pointInRect(model, r)) return id;
    }
    return null;
  };

  const gridDragTarget = (source: string, offset: Point): string | null => {
    const sourceNode = propsRef.current.nodes.find(
      (node) => node.id === source,
    );
    const sourceBox = boxFor(source);
    if (!sourceNode || !sourceBox) return null;
    const moved = boxToRect({
      ...sourceBox,
      x: sourceBox.x + offset.x,
      y: sourceBox.y + offset.y,
    });
    let target: string | null = null;
    let largestOverlap = 0;
    for (const node of propsRef.current.nodes) {
      if (
        node.id === source ||
        node.parent !== sourceNode.parent ||
        placedNodes.current.has(node.id) ||
        containersRef.current.has(node.id)
      )
        continue;
      if (
        !isNodeVisible(
          node.id,
          propsRef.current.edges,
          propsRef.current.edgeMode,
        )
      )
        continue;
      if (isolatedIdsRef.current && !isolatedIdsRef.current.has(node.id))
        continue;
      const box = boxFor(node.id);
      if (!box) continue;
      const bounds = boxToRect(box);
      const overlap =
        Math.max(
          0,
          Math.min(moved.x2, bounds.x2) - Math.max(moved.x1, bounds.x1),
        ) *
        Math.max(
          0,
          Math.min(moved.y2, bounds.y2) - Math.max(moved.y1, bounds.y1),
        );
      if (overlap > largestOverlap) {
        largestOverlap = overlap;
        target = node.id;
      }
    }
    return target;
  };

  const hitTestProperty = (model: Point, role: "source" | "target") => {
    if (
      propsRef.current.edgeMode === "nodes" ||
      propsRef.current.edgeMode === "workflow"
    )
      return null;
    const reverse = propsRef.current.direction === "RL";
    const radius = Math.max(16, 6 / viewport.zoom);
    let closest: { nodeId: string; property: string; distance: number } | null =
      null;
    for (const node of [...propsRef.current.nodes].reverse()) {
      if (
        !isNodeVisible(
          node.id,
          propsRef.current.edges,
          propsRef.current.edgeMode,
        )
      )
        continue;
      if (isolatedIdsRef.current && !isolatedIdsRef.current.has(node.id))
        continue;
      const box = boxFor(node.id);
      const rows = propertyRowsRef.current.get(node.id);
      if (!box || !rows || containersRef.current.has(node.id)) continue;
      const portX =
        box.x + (((role === "source") !== reverse ? 1 : -1) * box.w) / 2;
      for (const row of rows) {
        if (row.role && row.role !== role) continue;
        const top = box.y - box.h / 2 + row.top;
        const distance = Math.hypot(
          model.x - (row.anchor ? box.x - box.w / 2 + row.anchor.x : portX),
          model.y - top - row.height / 2,
        );
        const inside =
          !row.anchor &&
          model.x >= box.x - box.w / 2 &&
          model.x <= box.x + box.w / 2 &&
          model.y >= top &&
          model.y <= top + row.height;
        if (inside) return { nodeId: node.id, property: row.property };
        if (distance <= radius && (!closest || distance < closest.distance))
          closest = { nodeId: node.id, property: row.property, distance };
      }
    }
    return closest;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.currentTarget.contains(e.target as Node)) return;
    if (!gestureRef.current) suppressClickRef.current = false;
    if ((e.target as Element).closest(".flow-sdk-canvas") !== e.currentTarget)
      return;
    if (e.button !== 0 || propsRef.current.readOnly) return;
    const target = e.target as Element;
    if (
      target.closest(
        'input, textarea, select, [contenteditable="true"], [data-flow-content-toggle]',
      )
    )
      return;
    const p = propsRef.current;
    const rendered = toRendered(e);
    if (e.pointerType === "touch") {
      touchesRef.current.set(e.pointerId, rendered);
      const pinch = measurePinch(touchesRef.current);
      if (pinch) {
        setGridDrag(null);
        gestureRef.current = {
          kind: "pinch",
          distance: pinch.distance,
          zoom: viewport.zoom,
          anchor: viewport.renderedToModel(pinch.center),
        };
        setGhost(null);
        setBoxRect(null);
        suppressClickRef.current = true;
        for (const pointerId of touchesRef.current.keys())
          e.currentTarget.setPointerCapture(pointerId);
        return;
      }
    }
    if (gestureRef.current) return;
    if (
      nodeGridRef.current ||
      (e.shiftKey && (p.onNodeGridDrop || p.onNodeParentChange))
    ) {
      if (nodeGridRef.current && !nodeGridRef.current.ready) return;
      if (
        target.closest(
          "button, input, textarea, select, a, [contenteditable=true], [data-flow-content]",
        )
      )
        return;
      const source =
        target.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
      if (source && !placedNodes.current.has(source)) {
        gestureRef.current = {
          kind: "grid",
          pointerId: e.pointerId,
          source,
          start: rendered,
          moved: false,
        };
        return;
      }
      if (source) return;
    }
    const handle = p.drawHandles && target.closest(".flow-sdk-handle");
    const port =
      p.drawHandles && target.closest<HTMLElement>(".flow-sdk-property-port");
    if (!nodeGridRef.current && (p.drawMode || handle || port)) {
      const model = viewport.renderedToModel(rendered);
      const row = p.drawMode ? hitTestProperty(model, "source") : null;
      const control = port || handle;
      const hit = control
        ? control.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId
        : (row?.nodeId ?? hitTestNode(model));
      const sourceProperty = port ? port.dataset.property : row?.property;
      if (hit) {
        gestureRef.current = {
          kind: "draw",
          pointerId: e.pointerId,
          source: hit,
          sourceProperty,
          reverse: port?.dataset.portRole === "target",
          startClient: { x: e.clientX, y: e.clientY },
        };
        suppressClickRef.current = true;
        setGhost({ source: hit, sourceProperty, point: model, target: null });
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (
      target.closest(
        ".flow-sdk-node, .flow-sdk-container, .flow-sdk-edge, .flow-sdk-edge-label, .flow-sdk-container-label",
      )
    )
      return;
    geometryFocus.current = null;
    if (p.multiSelect) {
      gestureRef.current = {
        kind: "box",
        pointerId: e.pointerId,
        start: rendered,
        current: rendered,
      };
    } else if (p.dragMode) {
      gestureRef.current = {
        kind: "pan",
        pointerId: e.pointerId,
        start: rendered,
        pan0: viewport.pan,
        moved: false,
      };
    } else {
      gestureRef.current = {
        kind: "tap",
        pointerId: e.pointerId,
        start: rendered,
        moved: false,
      };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || propsRef.current.readOnly) return;
    const rendered = toRendered(e);
    if (touchesRef.current.has(e.pointerId))
      touchesRef.current.set(e.pointerId, rendered);
    if (g.kind === "pinch") {
      const pinch = measurePinch(touchesRef.current);
      if (!pinch) return;
      const zoom = Math.max(
        viewport.minZoom,
        Math.min(viewport.maxZoom, (g.zoom * pinch.distance) / g.distance),
      );
      if (
        zoom < viewport.zoom &&
        nodeGridRef.current?.options.fill &&
        propsRef.current.onNodeGridZoomOut?.(nodeGridRef.current.options) ===
          true
      )
        return;
      viewport.set(
        {
          x: pinch.center.x - g.anchor.x * zoom,
          y: pinch.center.y - g.anchor.y * zoom,
        },
        zoom,
      );
      return;
    }
    if (g.pointerId !== e.pointerId) return;
    switch (g.kind) {
      case "grid": {
        const offset = { x: rendered.x - g.start.x, y: rendered.y - g.start.y };
        if (!g.moved && Math.hypot(offset.x, offset.y) <= TAP_THRESHOLD) return;
        if (!g.moved) {
          cancelAnim();
          geometryFocus.current = null;
          viewport.cancelAnimation();
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        g.moved = true;
        suppressClickRef.current = true;
        e.preventDefault();
        const modelOffset = {
          x: offset.x / viewport.zoom,
          y: offset.y / viewport.zoom,
        };
        setGridDrag({
          source: g.source,
          offset: modelOffset,
          target: e.shiftKey ? null : gridDragTarget(g.source, modelOffset),
          shiftKey: e.shiftKey,
        });
        break;
      }
      case "pan": {
        const dx = rendered.x - g.start.x;
        const dy = rendered.y - g.start.y;
        if (!g.moved && Math.hypot(dx, dy) <= TAP_THRESHOLD) return;
        g.moved = true;
        suppressClickRef.current = true;
        viewport.set({ x: g.pan0.x + dx, y: g.pan0.y + dy });
        break;
      }
      case "tap": {
        if (
          Math.hypot(rendered.x - g.start.x, rendered.y - g.start.y) >
          TAP_THRESHOLD
        )
          g.moved = true;
        break;
      }
      case "box": {
        suppressClickRef.current = true;
        g.current = rendered;
        setBoxRect({
          x1: Math.min(g.start.x, rendered.x),
          y1: Math.min(g.start.y, rendered.y),
          x2: Math.max(g.start.x, rendered.x),
          y2: Math.max(g.start.y, rendered.y),
        });
        break;
      }
      case "draw": {
        const model = viewport.renderedToModel(rendered);
        const row = hitTestProperty(model, g.reverse ? "source" : "target");
        setGhost(
          g.reverse && row
            ? {
                source: row.nodeId,
                sourceProperty: row.property,
                point: model,
                target: g.source,
                targetProperty: g.sourceProperty,
              }
            : {
                source: g.source,
                sourceProperty: g.sourceProperty,
                point: model,
                target: row?.nodeId ?? hitTestNode(model, g.source),
                targetProperty: row?.property,
              },
        );
        break;
      }
    }
  };

  const endGesture = (e: React.PointerEvent, cancelled: boolean) => {
    touchesRef.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (!g) return;
    if (g.kind === "pinch") {
      const remaining = [...touchesRef.current][0];
      gestureRef.current =
        remaining && propsRef.current.dragMode && !cancelled
          ? {
              kind: "pan",
              pointerId: remaining[0],
              start: remaining[1],
              pan0: viewport.pan,
              moved: true,
            }
          : null;
      return;
    }
    if (g.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const p = propsRef.current;
    cancelled = cancelled || !!p.readOnly;
    switch (g.kind) {
      case "grid": {
        setGridDrag(null);
        if (cancelled || !g.moved) break;
        if (
          p.onNodeGridDrop?.(
            g.source,
            { x: e.clientX, y: e.clientY },
            {
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              altKey: e.altKey,
            },
          ) === true
        )
          break;
        const rendered = toRendered(e);
        if (
          rendered.x < 0 ||
          rendered.y < 0 ||
          rendered.x > viewport.size.w ||
          rendered.y > viewport.size.h
        )
          break;
        if (e.shiftKey) {
          const byId = new Map(p.nodes.map((node) => [node.id, node]));
          let targetId = hitTestNode(
            viewport.renderedToModel(rendered),
            g.source,
          );
          const seen = new Set<string>();
          while (
            targetId &&
            !byId.get(targetId)?.acceptsChildren &&
            !seen.has(targetId)
          ) {
            seen.add(targetId);
            targetId = byId.get(targetId)?.parent ?? null;
          }
          if (targetId && byId.get(targetId)?.acceptsChildren) {
            let ancestor: string | undefined = targetId;
            const ancestors = new Set<string>();
            while (ancestor && !ancestors.has(ancestor)) {
              ancestors.add(ancestor);
              ancestor = byId.get(ancestor)?.parent;
            }
            if (!ancestors.has(g.source))
              p.onNodeParentChange?.(g.source, targetId);
          }
          break;
        }
        if (!nodeGridRef.current) break;
        const target = gridDragTarget(g.source, {
          x: (rendered.x - g.start.x) / viewport.zoom,
          y: (rendered.y - g.start.y) / viewport.zoom,
        });
        if (target) engine.swapGridNodes(g.source, target, false);
        break;
      }
      case "pan":
      case "tap":
        if (!cancelled && !g.moved) p.onBackgroundTap?.();
        break;
      case "box": {
        setBoxRect(null);
        if (cancelled) break;
        const a = viewport.renderedToModel(g.start);
        const b = viewport.renderedToModel(g.current);
        const box: Rect = {
          x1: Math.min(a.x, b.x),
          y1: Math.min(a.y, b.y),
          x2: Math.max(a.x, b.x),
          y2: Math.max(a.y, b.y),
        };
        if (box.x2 - box.x1 < 1 && box.y2 - box.y1 < 1) {
          p.onBackgroundTap?.();
          break;
        }
        const ids: string[] = [];
        for (const n of p.nodes) {
          const bx = boxFor(n.id);
          if (bx && rectsIntersect(boxToRect(bx), box)) ids.push(n.id);
        }
        if (ids.length) p.onBoxSelect?.(ids);
        break;
      }
      case "draw": {
        setGhost(null);
        if (cancelled) break;
        const rendered = toRendered(e);
        const model = viewport.renderedToModel(rendered);
        const row = hitTestProperty(model, g.reverse ? "source" : "target");
        const target = row?.nodeId ?? hitTestNode(model);
        if (
          target === g.source &&
          (g.sourceProperty === undefined ||
            row?.property === undefined ||
            row.property === g.sourceProperty)
        )
          break;
        if (target)
          p.onEdgeDraw?.(
            g.reverse ? target : g.source,
            g.reverse ? g.source : target,
            g.sourceProperty !== undefined || row?.property !== undefined
              ? {
                  sourceProperty: g.reverse ? row?.property : g.sourceProperty,
                  targetProperty: g.reverse ? g.sourceProperty : row?.property,
                }
              : undefined,
          );
        else if (
          Math.max(
            Math.abs(e.clientX - g.startClient.x),
            Math.abs(e.clientY - g.startClient.y),
          ) > DRAW_INTO_SPACE_THRESHOLD
        )
          p.onDrawIntoSpace?.(g.source, model, g.sourceProperty, g.reverse);
        break;
      }
    }
  };

  const cancelGesture = useCallback(() => {
    const gesture = gestureRef.current;
    const pointerIds = [...touchesRef.current.keys()];
    if (gesture && gesture.kind !== "pinch") pointerIds.push(gesture.pointerId);
    gestureRef.current = null;
    touchesRef.current.clear();
    setGridDrag(null);
    setGhost(null);
    setBoxRect(null);
    for (const pointerId of pointerIds) {
      if (rootRef.current?.hasPointerCapture(pointerId))
        rootRef.current.releasePointerCapture(pointerId);
    }
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelGesture();
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("blur", cancelGesture);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("blur", cancelGesture);
      gestureRef.current = null;
      touchesRef.current.clear();
    };
  }, [cancelGesture]);

  useEffect(() => {
    cancelGesture();
  }, [
    drawMode,
    dragMode,
    multiSelect,
    edgeMode,
    direction,
    props.drawHandles,
    props.readOnly,
    nodeGridMode,
    cancelGesture,
  ]);

  // ── render ──
  const loopIndex = useMemo(() => {
    const counts = new Map<string, number>();
    const m = new Map<string, number>();
    for (const e of visibleEdges) {
      if (e.source !== e.target) continue;
      const n = counts.get(e.source) ?? 0;
      counts.set(e.source, n + 1);
      m.set(e.id, n);
    }
    return m;
  }, [visibleEdges]);

  const taxiDir = TAXI_DIR[direction];
  const [labelLayer, setLabelLayer] = useState<SVGGElement | null>(null);
  const edgeSequence = useEdgeRevealSequence(
    nodes,
    visibleEdges,
    !!props.edgeReveal?.revealNodes,
  );
  useLayoutEffect(() => {
    if (rootRef.current && labelLayer) placeEdgeLabels(rootRef.current);
  });
  const branches = branchRoutes(visibleEdges, edgeBoxFor, taxiDir);
  const onEdgeSelect = props.onEdgeSelect;
  const onContainerSelect = props.onContainerSelect;

  const ghostTarget = ghost
    ? (ghost.target && edgeBoxFor(ghost.target, ghost.targetProperty)) || {
        x: ghost.point.x,
        y: ghost.point.y,
        w: 1,
        h: 1,
      }
    : null;
  const ghostSource = ghost
    ? edgeBoxFor(ghost.source, ghost.sourceProperty)
    : null;

  const rootClass = [
    "flow-sdk-canvas",
    drawMode && !nodeGridMode ? "flow-sdk-draw" : "",
    isPerformanceMode ? "flow-sdk-perf" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClass}
      data-edge-mode={edgeMode}
      data-node-grid={nodeGridMode || undefined}
      onPointerDownCapture={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endGesture(e, false)}
      onPointerCancel={(e) => endGesture(e, true)}
      onLostPointerCapture={(event) => {
        const gesture = gestureRef.current;
        if (
          gesture &&
          (gesture.kind === "pinch" || gesture.pointerId === event.pointerId)
        )
          cancelGesture();
      }}
      onClickCapture={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        const fullscreenControl =
          event.target instanceof Element &&
          event.target.closest("button[data-flow-fullscreen]");
        if (
          suppressClickRef.current ||
          (props.readOnly && !fullscreenControl)
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <svg className="flow-sdk-svg">
        <g ref={svgGroupRef}>
          <g className="flow-sdk-containers">
            {[...containers]
              .filter(([id]) => isNodeVisible(id, edges, edgeMode))
              .filter(([id]) => !isolatedIds || isolatedIds.has(id))
              .map(([id, rect]) => (
                <ContainerView
                  key={id}
                  id={id}
                  rect={rect}
                  label={labelById.get(id)}
                  labelLayer={labelLayer}
                  labelContent={
                    nodes.find(
                      (node) => node.id === id && node.label !== undefined,
                    )?.element
                  }
                  style={containerStyle(id)}
                  onSelect={onContainerSelect}
                  onCollapse={
                    props.readOnly ? undefined : props.onContainerCollapse
                  }
                  selected={props.selectedNodeIds?.includes(id)}
                />
              ))}
          </g>
          <g className="flow-sdk-edges">
            {edgesVisible &&
              !nodeGridMode &&
              visibleEdges.map((e) => {
                if (!edgeSequence.ready.has(e.id)) return null;
                if (
                  isolatedIds &&
                  (!isolatedIds.has(e.source) || !isolatedIds.has(e.target))
                )
                  return null;
                const s = edgeBoxFor(e.source, e.sourceProperty);
                const t = edgeBoxFor(e.target, e.targetProperty);
                if (!s || !t) return null;
                return (
                  <EdgeView
                    key={e.id}
                    id={e.id}
                    edgeData={e.data}
                    validationIssue={e.validationIssue}
                    edgeType={e.type}
                    edgeRadius={props.edgeRadius}
                    propertyMode={propertyMode}
                    customEdgeTypes={props.customEdgeTypes}
                    reveal={props.edgeReveal}
                    onRevealComplete={edgeSequence.complete}
                    source={s}
                    target={t}
                    sourceProperty={e.sourceProperty}
                    targetProperty={e.targetProperty}
                    sourceY={propertyY(e.source, e.sourceProperty)}
                    targetY={propertyY(e.target, e.targetProperty)}
                    sourcePort={portFor(e.source, e.sourceProperty)}
                    targetPort={portFor(e.target, e.targetProperty)}
                    dir={taxiDir}
                    turn={branches.get(e.id)?.turn ?? e.turn}
                    labelAtTarget={branches.get(e.id)?.labelAtTarget}
                    labelFraction={branches.get(e.id)?.labelFraction}
                    color={e.color}
                    connectorColor={e.connectorColor}
                    labelBg={e.labelBg}
                    label={e.label}
                    labelLayer={labelLayer}
                    dashed={e.dashed}
                    animated={e.animated && !isPerformanceMode}
                    inverted={e.inverted}
                    loopIndex={loopIndex.get(e.id) ?? 0}
                    onSelect={onEdgeSelect}
                  />
                );
              })}
          </g>
          {edgesVisible &&
            !nodeGridMode &&
            ghost &&
            isEdgeVisible(ghost, edgeMode) &&
            ghostSource &&
            ghostTarget && (
              <g className="flow-sdk-ghost" pointerEvents="none">
                <EdgeView
                  id="__flow-sdk-ghost"
                  edgeData={{
                    id: "__flow-sdk-ghost",
                    source: ghost.source,
                    target: ghost.target ?? "",
                    sourceProperty: ghost.sourceProperty,
                    targetProperty: ghost.targetProperty,
                  }}
                  edgeType={props.edgeType}
                  edgeRadius={props.edgeRadius}
                  propertyMode={propertyMode}
                  customEdgeTypes={props.customEdgeTypes}
                  source={ghostSource}
                  target={ghostTarget}
                  sourceProperty={ghost.sourceProperty}
                  targetProperty={ghost.targetProperty}
                  sourceY={propertyY(ghost.source, ghost.sourceProperty)}
                  sourcePort={portFor(ghost.source, ghost.sourceProperty)}
                  targetPort={
                    ghost.target
                      ? portFor(ghost.target, ghost.targetProperty)
                      : undefined
                  }
                  targetY={
                    ghost.target
                      ? propertyY(ghost.target, ghost.targetProperty)
                      : undefined
                  }
                  dir={taxiDir}
                  turn={0.5}
                  color={lineColor}
                  labelBg={lineColor}
                />
              </g>
            )}
        </g>
      </svg>
      <div ref={nodesLayerRef} className="flow-sdk-nodes">
        {nodeGridMode &&
          nodeGridRef.current?.options.fill &&
          nodeGridRef.current.options.adjustment?.enabled &&
          !props.readOnly && (
            <GridAdjustmentHandles
              dividers={gridDividers}
              options={nodeGridRef.current.options}
              zoom={viewport.zoom}
              onChange={(options) =>
                engine.setNodeGridMode(true, { ...options, animate: false })
              }
            />
          )}
        {nodes.map((n) => {
          const p = positions.get(n.id);
          const c = containers.get(n.id);
          if (c && n.label !== undefined) return null;
          const x = p?.x ?? (c ? (c.x1 + c.x2) / 2 : 0);
          const y = p?.y ?? (c ? (c.y1 + c.y2) / 2 : 0);
          const previewTarget = gridDrag?.target
            ? n.id === gridDrag.source
              ? gridDrag.target
              : n.id === gridDrag.target
                ? gridDrag.source
                : undefined
            : undefined;
          const targetPosition = previewTarget
            ? positions.get(previewTarget)
            : undefined;
          const sourcePosition = gridDrag
            ? positions.get(gridDrag.source)
            : undefined;
          const destinationPosition = gridDrag?.target
            ? positions.get(gridDrag.target)
            : undefined;
          const distance =
            sourcePosition && destinationPosition
              ? {
                  x: destinationPosition.x - sourcePosition.x,
                  y: destinationPosition.y - sourcePosition.y,
                }
              : undefined;
          const distanceSquared = distance
            ? distance.x ** 2 + distance.y ** 2
            : 0;
          const progress =
            distanceSquared && gridDrag && distance
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    (gridDrag.offset.x * distance.x +
                      gridDrag.offset.y * distance.y) /
                      distanceSquared,
                  ),
                )
              : 0;
          const previewPosition = targetPosition
            ? {
                x: x + (targetPosition.x - x) * progress,
                y: y + (targetPosition.y - y) * progress,
              }
            : gridDrag?.source === n.id
              ? { x: x + gridDrag.offset.x, y: y + gridDrag.offset.y }
              : undefined;
          const ownSize = gridSizes.get(n.id);
          const targetSize = previewTarget
            ? gridSizes.get(previewTarget)
            : undefined;
          const previewSize =
            ownSize && targetSize
              ? {
                  w: ownSize.w + (targetSize.w - ownSize.w) * progress,
                  h: ownSize.h + (targetSize.h - ownSize.h) * progress,
                }
              : ownSize;
          return (
            <NodeHost
              key={n.id}
              id={n.id}
              x={x}
              y={y}
              gridDraggable={
                nodeGridMode &&
                !props.readOnly &&
                !placedNodes.current.has(n.id)
              }
              gridDragging={gridDrag?.source === n.id}
              gridDropTarget={gridDrag?.target === n.id}
              gridSize={gridSizes.get(n.id)}
              gridPreview={
                previewPosition
                  ? {
                      ...previewPosition,
                      size: previewSize,
                      floating: gridDrag?.shiftKey,
                    }
                  : undefined
              }
              placed={!!p || !!c}
              hidden={
                (!nodeGridMode && !edgeSequence.shown.has(n.id)) ||
                !isNodeVisible(n.id, edges, edgeMode) ||
                (!!isolatedIds && !isolatedIds.has(n.id))
              }
              onMount={onHostMount}
              drawHandles={
                props.drawHandles && !props.readOnly && !nodeGridMode
              }
              drawMode={drawMode && !nodeGridMode}
              connectedPorts={
                new Set(
                  visibleEdges.flatMap((edge) => [
                    ...(edge.source === n.id &&
                    edge.sourceProperty !== undefined
                      ? [`source:${edge.sourceProperty}`]
                      : []),
                    ...(edge.target === n.id &&
                    edge.targetProperty !== undefined
                      ? [`target:${edge.targetProperty}`]
                      : []),
                  ]),
                )
              }
              hasCollapseControl={n.hasCollapseControl}
              handleColor={lineColor}
              animated={n.animated && !c && !isPerformanceMode && !nodeGridMode}
              animationColor={n.animationColor}
              animationWidth={n.animationWidth}
              animationVariant={n.animationVariant}
              width={sizesRef.current.get(n.id)?.w}
              height={sizesRef.current.get(n.id)?.h}
              propertyMode={propertyMode}
              resolvedRows={resolvedPropertyRows.get(n.id)}
              reversePorts={direction === "RL"}
              direction={direction}
              onPropertyRows={onPropertyRows}
              onSurface={onSurface}
            >
              {ownSize ? (n.fillElement ?? n.element) : n.element}
            </NodeHost>
          );
        })}
      </div>
      {boxRect && (
        <div
          className="flow-sdk-box"
          style={{
            left: boxRect.x1,
            top: boxRect.y1,
            width: boxRect.x2 - boxRect.x1,
            height: boxRect.y2 - boxRect.y1,
          }}
        />
      )}
      <svg
        className="flow-sdk-svg flow-sdk-label-overlay"
        style={{ zIndex: 11, pointerEvents: "none" }}
      >
        <g
          ref={labelGroupRef}
          transform={`translate(${viewport.pan.x} ${viewport.pan.y}) scale(${viewport.zoom})`}
        >
          <g
            ref={setLabelLayer}
            className="flow-sdk-labels"
            style={{
              pointerEvents: drawMode ? "none" : "visiblePainted",
              outline: "none",
            }}
          />
        </g>
      </svg>
    </div>
  );
}

export default memo(Canvas);
