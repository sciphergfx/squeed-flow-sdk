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
  FlowEdgeProperties,
  NodeAlignment,
  FlowDiagramConfig,
  FlowDiagramEdge,
} from "../types";
import ContainerView, { type ContainerStyle } from "./ContainerView";
import EdgeView from "./EdgeView";
import { placeEdgeLabels } from "./labelPlacement";
import { branchRoutes } from "./branchRouting";
import type { TaxiDir } from "./geometry";
import { computeContainers, runDagreLayout } from "./layout";
import NodeHost from "./NodeHost";
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
import { Viewport } from "./viewport";

export interface CanvasNode {
  id: string;
  collapsed?: boolean;
  hasCollapseControl?: boolean;
  parent?: string;
  /** Compound label drawn on the container (cytoscape `data(label)`) */
  label?: string;
  animated?: boolean;
  animationColor?: string;
  animationWidth?: number;
  element: React.ReactNode;
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
  edgeType?: FlowDiagramConfig["edgeType"];
  edgeRadius?: number;
  customEdgeTypes?: FlowDiagramConfig["customEdgeTypes"];
  rankSep: number;
  edgeSep: number;
  spacingFactor?: number;
  layoutDebounce: number;
  isPerformanceMode: boolean;
  minZoom: number;
  maxZoom: number;
  initialViewport: ViewportState;
  fitOnInit?: boolean;
  readOnly?: boolean;
  containerStyle: (id: string) => ContainerStyle & { padding: number };
  /** Ghost edge colour while drawing */
  lineColor: string;
  drawMode: boolean;
  drawHandles?: boolean;
  dragMode: boolean;
  multiSelect: boolean;
  onInit?: (engine: FlowEngine) => void;
  onViewportChange?: (vp: ViewportState) => void;
  onBackgroundTap?: () => void;
  onBoxSelect?: (ids: string[]) => void;
  onEdgeSelect?: (id: string) => void;
  onContainerSelect?: (id: string) => void;
  onEdgeDraw?: (
    sourceId: string,
    targetId: string,
    properties?: FlowEdgeProperties,
  ) => void;
  onDrawIntoSpace?: (sourceId: string, modelPos: Point) => void;
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
const LAYOUT_ANIMATION_MS = 300;
const LAYOUT_SETTLE_MS = 500;
const CONTAINER_LABEL_BG_PADDING = 45;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
      kind: "draw";
      pointerId: number;
      source: string;
      sourceProperty?: string;
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
    edgeMode = "nodes",
    rankSep,
    edgeSep,
    spacingFactor = 1.3,
    minZoom,
    maxZoom,
    initialViewport,
    containerStyle,
    lineColor,
    drawMode,
    dragMode,
    multiSelect,
    isPerformanceMode,
  } = props;

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

  // ── node sizes (ResizeObserver over the DOM hosts) ──
  const sizesRef = useRef(new Map<string, Size>());
  const elByIdRef = useRef(new Map<string, HTMLDivElement>());
  const idByElRef = useRef(new Map<Element, string>());
  const roRef = useRef<ResizeObserver | null>(null);
  const [propertyRows, setPropertyRows] = useState(
    new Map<string, PropertyRow[]>(),
  );
  const propertyRowsRef = useRef(propertyRows);
  propertyRowsRef.current = propertyRows;
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
  const hasLayoutRunRef = useRef(false);
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const settleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const animRef = useRef<number | null>(null);
  const animFallbackRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingFitRef = useRef(false);
  const previousSpacingFactor = useRef(spacingFactor);
  const [isolatedIds, setIsolatedIds] = useState<Set<string> | null>(null);
  const [edgesVisible, setEdgesVisible] = useState(true);
  const isolatedIdsRef = useRef<Set<string> | null>(null);
  const savedViewport = useRef<ViewportState | null>(null);
  const previousNodes = useRef(nodes);
  const revealedNodes = useRef<string[]>([]);
  const centerRevealed = useRef(false);

  const cancelAnim = () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    clearTimeout(animFallbackRef.current);
  };

  const onLayoutStop = () => {
    if (revealedNodes.current.length) centerRevealed.current = true;
    if (!hasLayoutRunRef.current && propsRef.current.fitOnInit !== false)
      pendingFitRef.current = true;
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      hasLayoutRunRef.current = true;
    }, LAYOUT_SETTLE_MS);
  };

  const animateTo = (target: Map<string, Point>) => {
    cancelAnim();
    const from = new Map(positionsRef.current);
    const start = performance.now();
    const finish = () => {
      cancelAnim();
      setPositions(target);
      onLayoutStop();
    };
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / LAYOUT_ANIMATION_MS);
      if (t >= 1) return finish();
      const e = easeInOutCubic(t);
      const next = new Map<string, Point>();
      target.forEach((p, id) => {
        const f0 = from.get(id);
        next.set(
          id,
          f0 ? { x: f0.x + (p.x - f0.x) * e, y: f0.y + (p.y - f0.y) * e } : p,
        );
      });
      setPositions(next);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    // rAF is paused in background tabs; still land on the final layout
    animFallbackRef.current = setTimeout(finish, LAYOUT_ANIMATION_MS + 100);
  };

  const runLayoutNow = () => {
    const p = propsRef.current;
    const inputs = p.nodes.map((n) => {
      const s = sizesRef.current.get(n.id) || DEFAULT_SIZE;
      return { id: n.id, parent: n.parent, width: s.w, height: s.h };
    });
    let target: Map<string, Point>;
    try {
      target = runDagreLayout(inputs, p.edges, {
        rankDir: p.direction,
        nodeAlignment: p.nodeAlignment,
        rankSep: p.rankSep,
        edgeSep: p.edgeSep,
        nodeSep: 5,
        spacingFactor: p.spacingFactor ?? 1.3,
      });
    } catch (err) {
      console.warn("[flow-sdk] layout failed", err);
      return;
    }
    if (hasLayoutRunRef.current && !p.isPerformanceMode) animateTo(target);
    else {
      cancelAnim();
      setPositions(target);
      onLayoutStop();
    }
  };

  const scheduleLayout = useCallback(() => {
    clearTimeout(layoutTimerRef.current);
    layoutTimerRef.current = setTimeout(
      runLayoutNow,
      propsRef.current.layoutDebounce,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previous = new Map(previousNodes.current.map(node => [node.id, node]));
    if (nodes.some(node => previous.get(node.id)?.collapsed === true && !node.collapsed)) {
      revealedNodes.current = nodes.filter(node => !previous.has(node.id)).map(node => node.id);
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
    scheduleLayout();
  }, [
    nodes,
    edges,
    direction,
    nodeAlignment,
    rankSep,
    edgeSep,
    scheduleLayout,
    spacingFactor,
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
            const t = entry.target as HTMLElement;
            const w = t.offsetWidth;
            const h = t.offsetHeight;
            if (!w && !h) continue;
            const prev = sizesRef.current.get(nid);
            if (prev && prev.w === w && prev.h === h) continue;
            sizesRef.current.set(nid, { w, h });
            changed = true;
          }
          if (changed) scheduleLayout();
        });
      }
      if (el) {
        elByIdRef.current.set(id, el);
        idByElRef.current.set(el, id);
        roRef.current?.observe(el);
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (w || h) sizesRef.current.set(id, { w, h });
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
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) if (n.label) m.set(n.id, n.label);
    return m;
  }, [nodes]);

  const containers = useMemo(
    () =>
      computeContainers(
        nodes,
        positions,
        sizesRef.current,
        (id) => containerStyle(id).padding,
        (id) => {
          const label = labelById.get(id);
          if (!label) return undefined;
          const st = containerStyle(id);
          const w = measureText(
            label,
            `bold ${st.fontSize}px ${EDGE_LABEL_FONT_FAMILY}`,
          );
          return { w: w + 2 * CONTAINER_LABEL_BG_PADDING, h: 0 };
        },
      ),
    [nodes, positions, containerStyle, labelById],
  );
  const containersRef = useRef(containers);
  containersRef.current = containers;

  const boxFor = useCallback((id: string): Box | undefined => {
    const r = containersRef.current.get(id);
    if (r) return rectToBox(r);
    const p = positionsRef.current.get(id);
    if (!p) return undefined;
    const s = sizesRef.current.get(id) || DEFAULT_SIZE;
    return { x: p.x, y: p.y, w: s.w, h: s.h };
  }, []);

  const propertyY = (id: string, property?: string): number | undefined => {
    if (edgeMode !== "properties" || property === undefined) return undefined;
    const row = propertyRows.get(id)?.find((row) => row.property === property);
    const box = boxFor(id);
    return row && box
      ? box.y - box.h / 2 + row.top + row.height / 2
      : undefined;
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
      viewport.size = { w, h };
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [viewport]);

  useEffect(() => {
    if (centerRevealed.current) {
      centerRevealed.current = false;
      const boxes = revealedNodes.current.flatMap(id => {
        const box = boxFor(id);
        return box ? [boxToRect(box)] : [];
      });
      revealedNodes.current = [];
      const bounds = unionRects(boxes);
      if (bounds) {
        pendingFitRef.current = false;
        viewport.center(bounds);
        return;
      }
    }
    if (!pendingFitRef.current) return;
    pendingFitRef.current = false;
    const bb = elementsBBox();
    if (bb) viewport.fit(bb, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  // ── engine handle ──
  const engine = useMemo<FlowEngine>(() => {
    const branchIds = (id: string) => {
      const current = propsRef.current;
      const ids = new Set([id]);
      const pending = [id];
      while (pending.length) {
        const parent = pending.pop()!;
        for (const node of current.nodes) {
          const child = node.parent === parent || node.id.startsWith(`${parent}.`) ||
            (!id.startsWith("root") && current.edges.some(edge =>
              (edge.inverted ? edge.target : edge.source) === parent &&
              (edge.inverted ? edge.source : edge.target) === node.id));
          if (child && !ids.has(node.id)) { ids.add(node.id); pending.push(node.id); }
        }
      }
      return ids;
    };
    const focus = (ids: Set<string>, padding = 50) => {
      const bounds = unionRects([...ids].flatMap(id => {
        const box = boxFor(id);
        return box ? [boxToRect(box)] : [];
      }));
      if (bounds) {
        pendingFitRef.current = false;
        viewport.fit(bounds, Number.isFinite(padding) ? Math.max(0, padding) : 50);
      }
    };
    const zoom = ((level?: number) => {
      if (level === undefined) return viewport.zoom;
      viewport.set(undefined, level);
    }) as FlowEngine["zoom"];
    const pan = ((p?: Point) => {
      if (p === undefined) return viewport.pan;
      viewport.set(p);
    }) as FlowEngine["pan"];
    const rendered = (clientX: number, clientY: number): Point => {
      const r = rootRef.current?.getBoundingClientRect();
      return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
    };
    return {
      zoom,
      pan,
      setEdgesVisible,
      focusNode: (id, padding) => focus(new Set([id]), padding),
      focusBranch: (id, padding) => focus(branchIds(id), padding),
      isolateBranch: (id, padding) => {
        if (!boxFor(id)) return;
        if (!savedViewport.current) savedViewport.current = { pan: { ...viewport.pan }, zoom: viewport.zoom };
        const ids = branchIds(id);
        isolatedIdsRef.current = ids;
        setIsolatedIds(ids);
        focus(ids, padding);
      },
      restoreView: () => {
        isolatedIdsRef.current = null;
        setIsolatedIds(null);
        const previous = savedViewport.current;
        savedViewport.current = null;
        if (previous) viewport.set(previous.pan, previous.zoom);
      },
      zoomAt: (level, pt) => viewport.zoomAt(level, pt),
      fit: (padding = 0) => {
        const bb = elementsBBox();
        if (bb) viewport.fit(bb, padding);
      },
      center: () => {
        const bb = elementsBBox();
        if (bb) viewport.center(bb);
      },
      clientToModel: (cx, cy) => viewport.renderedToModel(rendered(cx, cy)),
      modelToClient: (p) => {
        const r = rootRef.current?.getBoundingClientRect();
        const v = viewport.modelToRendered(p);
        return { x: v.x + (r?.left ?? 0), y: v.y + (r?.top ?? 0) };
      },
      getNodeBox: (id) => boxFor(id),
      onViewportChange: (fn) => viewport.onChange(fn),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    propsRef.current.onInit?.(engine);
  }, [engine]);

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
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const hitTestNode = (model: Point, exclude?: string): string | null => {
    const list = propsRef.current.nodes;
    for (let i = list.length - 1; i >= 0; i--) {
      const id = list[i].id;
      if (isolatedIdsRef.current && !isolatedIdsRef.current.has(id)) continue;
      if (id === exclude || containersRef.current.has(id)) continue;
      const b = boxFor(id);
      if (b && pointInRect(model, boxToRect(b))) return id;
    }
    for (const [id, r] of containersRef.current) {
      if (isolatedIdsRef.current && !isolatedIdsRef.current.has(id)) continue;
      if (id !== exclude && pointInRect(model, r)) return id;
    }
    return null;
  };

  const hitTestProperty = (model: Point, role: "source" | "target") => {
    if (propsRef.current.edgeMode !== "properties") return null;
    const reverse = propsRef.current.direction === "RL";
    const radius = Math.max(16, 6 / viewport.zoom);
    let closest: { nodeId: string; property: string; distance: number } | null =
      null;
    for (const node of [...propsRef.current.nodes].reverse()) {
      if (isolatedIdsRef.current && !isolatedIdsRef.current.has(node.id)) continue;
      const box = boxFor(node.id);
      const rows = propertyRowsRef.current.get(node.id);
      if (!box || !rows || containersRef.current.has(node.id)) continue;
      const portX =
        box.x + (((role === "source") !== reverse ? 1 : -1) * box.w) / 2;
      for (const row of rows) {
        if (row.role && row.role !== role) continue;
        const top = box.y - box.h / 2 + row.top;
        const distance = Math.hypot(
          model.x - portX,
          model.y - top - row.height / 2,
        );
        const inside =
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
    if (e.button !== 0 || propsRef.current.readOnly) return;
    const target = e.target as Element;
    if (target.closest('input, textarea, select, [contenteditable="true"]'))
      return;
    const p = propsRef.current;
    const rendered = toRendered(e);
    if (e.pointerType === "touch") {
      touchesRef.current.set(e.pointerId, rendered);
      const pinch = measurePinch(touchesRef.current);
      if (pinch) {
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
    suppressClickRef.current = false;
    const handle = p.drawHandles && target.closest(".flow-sdk-handle");
    const port =
      p.edgeMode === "properties" &&
      p.drawHandles &&
      target.closest<HTMLElement>(".flow-sdk-property-port");
    if (port && port.dataset.portRole !== "source") return;
    if (p.drawMode || handle || port) {
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
        const row = hitTestProperty(model, "target");
        setGhost({
          source: g.source,
          sourceProperty: g.sourceProperty,
          point: model,
          target: row?.nodeId ?? hitTestNode(model, g.source),
          targetProperty: row?.property,
        });
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
        const row = hitTestProperty(model, "target");
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
            g.source,
            target,
            g.sourceProperty !== undefined || row?.property !== undefined
              ? {
                  sourceProperty: g.sourceProperty,
                  targetProperty: row?.property,
                }
              : undefined,
          );
        else if (
          g.sourceProperty === undefined &&
          Math.max(
            Math.abs(e.clientX - g.startClient.x),
            Math.abs(e.clientY - g.startClient.y),
          ) > DRAW_INTO_SPACE_THRESHOLD
        )
          p.onDrawIntoSpace?.(g.source, model);
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
    cancelGesture,
  ]);

  // ── render ──
  const loopIndex = useMemo(() => {
    const counts = new Map<string, number>();
    const m = new Map<string, number>();
    for (const e of edges) {
      if (e.source !== e.target) continue;
      const n = counts.get(e.source) ?? 0;
      counts.set(e.source, n + 1);
      m.set(e.id, n);
    }
    return m;
  }, [edges]);

  const taxiDir = TAXI_DIR[direction];
  const [labelLayer, setLabelLayer] = useState<SVGGElement | null>(null);
  useLayoutEffect(() => {
    if (rootRef.current && labelLayer) placeEdgeLabels(rootRef.current);
  });
  const branches = branchRoutes(edges, boxFor, taxiDir);
  const onEdgeSelect = props.onEdgeSelect;
  const onContainerSelect = props.onContainerSelect;

  const ghostTarget = ghost
    ? (ghost.target && boxFor(ghost.target)) || {
        x: ghost.point.x,
        y: ghost.point.y,
        w: 1,
        h: 1,
      }
    : null;
  const ghostSource = ghost ? boxFor(ghost.source) : null;

  const rootClass = [
    "flow-sdk-canvas",
    drawMode ? "flow-sdk-draw" : "",
    isPerformanceMode ? "flow-sdk-perf" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClass}
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
        if (suppressClickRef.current || props.readOnly) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <svg className="flow-sdk-svg">
        <g ref={svgGroupRef}>
          <g className="flow-sdk-containers">
            {[...containers].filter(([id]) => !isolatedIds || isolatedIds.has(id)).map(([id, rect]) => (
              <ContainerView
                key={id}
                id={id}
                rect={rect}
                label={labelById.get(id)}
                labelLayer={labelLayer}
                style={containerStyle(id)}
                onSelect={onContainerSelect}
              />
            ))}
          </g>
          <g className="flow-sdk-edges">
            {edgesVisible && edges.map((e) => {
              if (isolatedIds && (!isolatedIds.has(e.source) || !isolatedIds.has(e.target))) return null;
              const s = boxFor(e.source);
              const t = boxFor(e.target);
              if (!s || !t) return null;
              return (
                <EdgeView
                  key={e.id}
                  id={e.id}
                  edgeData={e.data}
                  validationIssue={e.validationIssue}
                  edgeType={e.type}
                  edgeRadius={props.edgeRadius}
                  propertyMode={edgeMode === "properties"}
                  customEdgeTypes={props.customEdgeTypes}
                  source={s}
                  target={t}
                  sourceProperty={e.sourceProperty}
                  targetProperty={e.targetProperty}
                  sourceY={propertyY(e.source, e.sourceProperty)}
                  targetY={propertyY(e.target, e.targetProperty)}
                  dir={taxiDir}
                  turn={branches.get(e.id)?.turn ?? e.turn}
                  labelAtTarget={branches.get(e.id)?.labelAtTarget}
                  labelFraction={branches.get(e.id)?.labelFraction}
                  color={e.color}
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
          {edgesVisible && ghost && ghostSource && ghostTarget && (
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
                propertyMode={edgeMode === "properties"}
                customEdgeTypes={props.customEdgeTypes}
                source={ghostSource}
                target={ghostTarget}
                sourceProperty={ghost.sourceProperty}
                targetProperty={ghost.targetProperty}
                sourceY={propertyY(ghost.source, ghost.sourceProperty)}
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
        {nodes.map((n) => {
          const p = positions.get(n.id);
          const c = containers.get(n.id);
          const x = p?.x ?? (c ? (c.x1 + c.x2) / 2 : 0);
          const y = p?.y ?? (c ? (c.y1 + c.y2) / 2 : 0);
          return (
            <NodeHost
              key={n.id}
              id={n.id}
              x={x}
              y={y}
              placed={!!p || !!c}
              hidden={!!isolatedIds && !isolatedIds.has(n.id)}
              onMount={onHostMount}
              drawHandles={props.drawHandles && !props.readOnly}
              hasCollapseControl={n.hasCollapseControl}
              handleColor={lineColor}
              animated={n.animated && !c && !isPerformanceMode}
              animationColor={n.animationColor}
              animationWidth={n.animationWidth}
              width={sizesRef.current.get(n.id)?.w}
              height={sizesRef.current.get(n.id)?.h}
              propertyMode={edgeMode === "properties"}
              reversePorts={direction === "RL"}
              direction={direction}
              onPropertyRows={onPropertyRows}
            >
              {n.element}
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
            style={{ pointerEvents: drawMode ? "none" : "visiblePainted" }}
          />
        </g>
      </svg>
    </div>
  );
}

export default memo(Canvas);
