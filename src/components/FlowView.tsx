import { Box } from "@chakra-ui/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateOptimalSpacing } from "../core/layoutCalculations";
import { connectionIssue } from "../core/workflowContract";
import {
  Canvas,
  type CanvasEdge,
  type CanvasNode,
  type ContainerStyle,
  type FlowEngine,
} from "../engine";
import { getNodeBorderWidth } from "../nodes/nodeBorder";
import DefaultViews from "../nodes/nodeViews";
import {
  blendHexColors,
  getChakraColorHex,
  LIGHT_BLACK,
} from "../theme/colorUtils";
import {
  useCustomColors,
  useThemeContentColors,
} from "../theme/useCustomColors";
import type {
  FlowDiagramEdge,
  FlowDiagramNode,
  FlowEdgeProperties,
  ParentNodeStyle,
} from "../types";
import DotPatternBackground from "./DotPattern";
import { useFlowDiagramContext } from "./FlowDiagramContext";

/** cytoscape `:parent` stylesheet defaults */
export const PARENT_BG_OPACITY = 0.4;
const PARENT_DEFAULTS = {
  borderWidth: 6,
  borderStyle: "solid" as const,
  borderRadius: 50,
  fontSize: 70,
  padding: 120,
  labelPosition: "top" as const,
  labelMargin: 90,
};

interface FlowViewProps {
  nodes: FlowDiagramNode[];
  edges: FlowDiagramEdge[];
}

const FlowView = ({ nodes, edges }: FlowViewProps) => {
  const {
    themeColor,
    spacing,
    edgeRadius,
    backgroundVariant,
    setBackgroundSelected,
    edgeColor,
    direction,
    nodeAlignment,
    edgeMode,
    compactPropertyLayout,
    workflowContract,
    parentNodeStyle: parentDefaults,
    engineRef,
    callbacks,
    config,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    setIsPerformanceMode,
    isZoomMode,
    setIsZoomMode,
    isMultiSelectMode,
    setIsMultiSelectMode,
    isDragMode,
    setIsDragMode,
    isEdgeHandlesEnabled,
    setIsEdgeHandlesEnabled,
    isArrayNodeMode,
  } = useFlowDiagramContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<FlowEngine | null>(null);

  const isPerformanceMode = nodes.length > 200;
  useEffect(() => {
    setIsPerformanceMode(isPerformanceMode);
  }, [isPerformanceMode, setIsPerformanceMode]);

  const { edgeSep, rankSep, spacingFactor } = useMemo(() => {
    const base = calculateOptimalSpacing(nodes.length);
    const scale = spacing < 1 ? 0.3 + 0.7 * spacing : 0.5 + 0.5 * spacing;
    return {
      edgeSep: base.edgeSep * scale,
      rankSep: base.rankSep * scale,
      spacingFactor: 1.3 + (spacing - 1) * (spacing < 1 ? 0.4 : 0.3),
    };
  }, [nodes.length, spacing]);

  const { bgColor: highlightColor } = useThemeContentColors(themeColor);
  const {
    canvas: bgColor,
    borderSecondary: borderColor,
    colorText,
  } = useCustomColors();

  const effectiveBgColor =
    backgroundVariant === "transparent"
      ? "transparent"
      : config.backgroundColor || bgColor;

  const getColorHex = useCallback(
    (color) => {
      if (!color) return getChakraColorHex(themeColor);
      switch (color) {
        case "dark":
          return getChakraColorHex(effectiveBgColor);
        case "light":
          return getChakraColorHex(borderColor);
        default:
          return getChakraColorHex(color);
      }
    },
    [themeColor, effectiveBgColor, borderColor],
  );

  const isDark = config.colorMode === "dark";
  const autoLineColor = isDark ? getChakraColorHex("gray.500") : LIGHT_BLACK;
  const connectorColor = !isDark
    ? autoLineColor
    : highlightColor?.includes("gray")
      ? "whitesmoke"
      : getColorHex(highlightColor);
  const lineColor = edgeColor ? getColorHex(edgeColor) : autoLineColor;

  const initialViewport = useMemo(
    () => config.initialViewport || { pan: { x: 0, y: 0 }, zoom: 0.01 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const layoutDirection = (direction === "C" ? "LR" : direction) as
    | "LR"
    | "RL"
    | "TB"
    | "BT";

  // Resolve container style: per-node viewProps > config.parentNodeStyle > theme defaults
  const resolveParentStyle = useCallback(
    (
      viewProps?: ParentNodeStyle,
    ): Required<Pick<ParentNodeStyle, "bgColor" | "bgOpacity">> &
      ParentNodeStyle => {
      const s = { ...parentDefaults, ...viewProps };
      return {
        ...s,
        bgColor: s.bgColor || themeColor,
        bgOpacity: s.outline ? 0 : (s.bgOpacity ?? PARENT_BG_OPACITY),
      };
    },
    [parentDefaults, themeColor],
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, FlowDiagramNode>();
    for (const n of nodes) if (n.data?.id) m.set(n.data.id, n);
    return m;
  }, [nodes]);

  const edgeById = useMemo(() => {
    const m = new Map<string, FlowDiagramEdge>();
    for (const e of edges) if (e.data?.id) m.set(e.data.id, e);
    return m;
  }, [edges]);

  const containerStyle = useCallback(
    (id: string): ContainerStyle & { padding: number } => {
      const data = nodeById.get(id)?.data;
      const s = resolveParentStyle(data?.viewProps);
      const fill = getChakraColorHex(s.bgColor);
      return {
        animated: !!data?.isNodeAnimated && !isPerformanceMode,
        animationVariant: data?.nodeAnimationVariant,
        animationColor: getChakraColorHex(s.borderColor || themeColor),
        bgColor: s.outline ? "transparent" : fill,
        bgOpacity: s.bgOpacity,
        borderColor: s.borderColor
          ? getChakraColorHex(s.borderColor)
          : s.outline && s.bgColor === "transparent"
            ? getChakraColorHex(themeColor)
            : fill,
        borderWidth: getNodeBorderWidth(
          s.borderWidth,
          PARENT_DEFAULTS.borderWidth,
        ),
        borderStyle: s.borderStyle ?? PARENT_DEFAULTS.borderStyle,
        borderRadius: s.borderRadius ?? PARENT_DEFAULTS.borderRadius,
        textColor: s.textColor
          ? getChakraColorHex(s.textColor)
          : s.outline || s.bgColor === "transparent"
            ? getChakraColorHex(colorText)
            : fill,
        fontSize: s.fontSize ?? PARENT_DEFAULTS.fontSize,
        labelPosition: s.labelPosition ?? PARENT_DEFAULTS.labelPosition,
        labelMargin: PARENT_DEFAULTS.labelMargin,
        labelBg:
          blendHexColors(getColorHex("dark"), fill, s.bgOpacity) ??
          getColorHex("dark"),
        padding: s.padding ?? PARENT_DEFAULTS.padding,
      };
    },
    [
      resolveParentStyle,
      nodeById,
      colorText,
      themeColor,
      isPerformanceMode,
      getColorHex,
    ],
  );

  // Spread parallel/opposite edges so taxi segments and labels don't stack
  const parallelTurns = useMemo(() => {
    const groups = new Map<string, { id: string; source: string }[]>();
    for (const e of edges) {
      const s = e.data?.source;
      const t = e.data?.target;
      if (!s || !t || s === t) continue;
      const key = s < t ? `${s}|${t}` : `${t}|${s}`;
      const g = groups.get(key);
      if (g) g.push({ id: e.data.id, source: s });
      else groups.set(key, [{ id: e.data.id, source: s }]);
    }
    const turns = new Map<string, number>();
    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      const first = key.split("|")[0];
      const step = Math.min(20, 70 / group.length);
      group.forEach(({ id, source }, i) => {
        const t = 50 + (i - (group.length - 1) / 2) * step;
        turns.set(id, (source === first ? t : 100 - t) / 100);
      });
    }
    return turns;
  }, [edges]);

  const canvasEdges = useMemo<CanvasEdge[]>(() => {
    const canvasHex = getColorHex("dark");
    return edges
      .filter((e) => e.data?.id && e.data.source && e.data.target)
      .map(({ data }) => {
        let labelBg = canvasHex;
        // Inside a compound node the label bg should match the container, not the canvas
        const sp = nodeById.get(data.source)?.data?.parent;
        const tp = nodeById.get(data.target)?.data?.parent;
        if (sp && sp === tp) {
          const ps = resolveParentStyle(nodeById.get(sp)?.data?.viewProps);
          const blended = blendHexColors(
            canvasHex,
            getChakraColorHex(ps.bgColor),
            ps.bgOpacity,
          );
          if (blended) labelBg = blended;
        }
        return {
          id: data.id,
          data,
          type: data.type ?? config.edgeType ?? "rounded-orthogonal",
          source: data.source,
          target: data.target,
          sourceProperty: data.sourceProperty,
          targetProperty: data.targetProperty,
          label: data.label,
          validationIssue:
            (edgeMode === "auto" || edgeMode === "properties") &&
            (data.sourceProperty !== undefined ||
              data.targetProperty !== undefined) &&
            workflowContract
              ? connectionIssue(workflowContract, data)
              : undefined,
          color: edgeColor
            ? lineColor
            : data.color
              ? getChakraColorHex(data.color)
              : lineColor,
          connectorColor: edgeColor
            ? lineColor
            : data.color
              ? getChakraColorHex(data.color)
              : connectorColor,
          labelBg,
          dashed: !!data.isEdgeDashed,
          animated: !!data.isEdgeAnimated,
          inverted: !!data.isInverted,
          turn: parallelTurns.get(data.id) ?? 0.5,
        };
      });
  }, [
    edges,
    lineColor,
    connectorColor,
    edgeColor,
    parallelTurns,
    config.edgeType,
    edgeMode,
    workflowContract,
    nodeById,
    resolveParentStyle,
    getColorHex,
  ]);

  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of nodes) {
      if (n.data?.parent) ids.add(n.data.parent);
    }
    return ids;
  }, [nodes]);

  const edgeBySource = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of edges) {
      if (e.data?.source && !map.has(e.data.source))
        map.set(e.data.source, e.data);
    }
    return map;
  }, [edges]);

  const canvasNodes = useMemo<CanvasNode[]>(() => {
    const Views = { ...DefaultViews, ...config.customViews };
    return nodes
      .filter((n) => n.data?.id)
      .map((node) => {
        const isParentContainer =
          parentIds.has(node.data.id) && !node.data.parent;
        const nodeLabel = isParentContainer
          ? (node.data.label ?? node.data.headerTitle ?? "Container")
          : undefined;
        const ViewComponent = isParentContainer
          ? Views.parentContainer
          : Views[node.data.type] || Views.text;
        const edgeData = edgeBySource.get(node.data.id);
        return {
          id: node.data.id,
          collapsed: node.data.config?.collapsed,
          parent: node.data.parent,
          label: nodeLabel,
          animated: !!node.data.isNodeAnimated,
          animationVariant: node.data.nodeAnimationVariant,
          hasCollapseControl: node.data.config?.collapsed !== undefined,
          animationColor: getChakraColorHex(
            node.data.viewProps?.borderColor || themeColor,
          ),
          animationWidth: getNodeBorderWidth(
            node.data.viewProps?.borderWidth,
            8,
          ),
          element: (
            <ViewComponent
              {...node}
              isInverted={edgeData?.isInverted}
              isParent={isParentContainer}
              key={`${node.data.id}-${themeColor}`}
            />
          ),
        };
      });
  }, [nodes, parentIds, edgeBySource, themeColor, config.customViews]);

  const layoutDebounce = useMemo(() => {
    if (isPerformanceMode) return 300;
    if (nodes.length > 50) return 150;
    if (nodes.length > 20) return 100;
    return 50;
  }, [nodes.length, isPerformanceMode]);

  // ── refs for handlers ──
  const configRef = useRef(config);
  configRef.current = config;
  const isZoomModeRef = useRef(isZoomMode);
  isZoomModeRef.current = isZoomMode;
  const isArrayNodeModeRef = useRef(isArrayNodeMode);
  isArrayNodeModeRef.current = isArrayNodeMode;
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  const selectedEdgeIdRef = useRef(selectedEdgeId);
  selectedEdgeIdRef.current = selectedEdgeId;
  const isMultiSelectModeRef = useRef(isMultiSelectMode);
  isMultiSelectModeRef.current = isMultiSelectMode;
  const nodeByIdRef = useRef(nodeById);
  nodeByIdRef.current = nodeById;
  const edgeByIdRef = useRef(edgeById);
  edgeByIdRef.current = edgeById;
  const previousEdgesRef = useRef(new Map<string, FlowDiagramEdge>());
  useEffect(() => {
    const current = new Map(
      [...edgeById].filter(
        ([, edge]) =>
          nodeById.has(edge.data.source) && nodeById.has(edge.data.target),
      ),
    );
    const previous = previousEdgesRef.current;
    previousEdgesRef.current = current;
    for (const [id, edge] of previous) {
      if (current.has(id)) continue;
      if (selectedEdgeIdRef.current === id) {
        setSelectedEdgeId(null);
        callbacks.onEdgeDeselect?.();
      }
      callbacks.onEdgeRemove?.(id, edge.data);
    }
  }, [edgeById, nodeById, callbacks, setSelectedEdgeId]);

  // Wheel: pan by default, zoom in zoom mode or with ⌘/Ctrl
  useEffect(() => {
    const el = containerRef.current;
    if (!engine || !el) return;
    let panRafId: number | null = null;
    let zoomRafId: number | null = null;
    let accPanDX = 0;
    let accPanDY = 0;
    let accZoomDY = 0;
    let lastZoomClientX = 0;
    let lastZoomClientY = 0;

    const wheelHandler = (e: WheelEvent) => {
      if (configRef.current.readOnly) return;
      e.preventDefault();
      e.stopPropagation();

      const isZoom = isZoomModeRef.current || e.metaKey || e.ctrlKey;

      if (isZoom) {
        accZoomDY += e.deltaY;
        lastZoomClientX = e.clientX;
        lastZoomClientY = e.clientY;

        if (zoomRafId === null) {
          zoomRafId = requestAnimationFrame(() => {
            zoomRafId = null;
            const cfg = configRef.current;
            const zoom = engine.zoom();
            const dy = accZoomDY;
            accZoomDY = 0;

            let newZoom = zoom - (dy * 0.05) / 100;
            newZoom = Math.max(
              cfg.minZoom ?? 0.01,
              Math.min(cfg.maxZoom ?? 1.5, newZoom),
            );
            const rect = el.getBoundingClientRect();
            engine.zoomAt(newZoom, {
              x: lastZoomClientX - rect.left,
              y: lastZoomClientY - rect.top,
            });
          });
        }
      } else {
        accPanDX += e.deltaX;
        accPanDY += e.deltaY;

        if (panRafId === null) {
          panRafId = requestAnimationFrame(() => {
            panRafId = null;
            const pan = engine.pan();
            const zoom = engine.zoom();
            const panSpeed = 0.35;
            const dx = accPanDX;
            const dy = accPanDY;
            accPanDX = 0;
            accPanDY = 0;

            engine.pan({
              x: pan.x + (-dx * panSpeed) / zoom,
              y: pan.y + (-dy * panSpeed) / zoom,
            });
          });
        }
      }
    };
    el.addEventListener("wheel", wheelHandler, { passive: false });

    return () => {
      el.removeEventListener("wheel", wheelHandler);
      if (panRafId !== null) cancelAnimationFrame(panRafId);
      if (zoomRafId !== null) cancelAnimationFrame(zoomRafId);
    };
  }, [engine]);

  useEffect(() => {
    if (config.disableKeyboardShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      if (configRef.current.readOnly) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.key === "z" || e.key === "Z") setIsZoomMode(!isZoomModeRef.current);
      if (e.key === "m" || e.key === "M")
        setIsMultiSelectMode(!isMultiSelectMode);
      if (e.key === "d" || e.key === "D") setIsDragMode(!isDragMode);
      if (
        (e.key === "v" || e.key === "V") &&
        !e.repeat &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        target.tagName !== "SELECT"
      )
        setIsEdgeHandlesEnabled(!isEdgeHandlesEnabled);

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedEdgeIdRef.current
      ) {
        e.preventDefault();
        const edgeId = selectedEdgeIdRef.current;
        callbacks.onEdgeDelete?.(
          edgeId,
          edgeByIdRef.current.get(edgeId)?.data ?? { id: edgeId },
        );
        setSelectedEdgeId(null);
        return;
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedNodeIdsRef.current.length > 0
      ) {
        e.preventDefault();
        const ids = selectedNodeIdsRef.current.filter((id) => id !== "root");
        if (ids.length === 0) return;
        for (const nodeId of ids) {
          const nodeData = nodeByIdRef.current.get(nodeId)?.data;
          callbacks.onNodeDelete?.(nodeId, nodeData || {});
        }
        setSelectedNodeIds([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    isMultiSelectMode,
    isDragMode,
    isEdgeHandlesEnabled,
    setIsEdgeHandlesEnabled,
    setIsZoomMode,
    setIsMultiSelectMode,
    setIsDragMode,
    config.disableKeyboardShortcuts,
    callbacks,
    setSelectedNodeIds,
    setSelectedEdgeId,
  ]);

  // ── canvas callbacks ──
  const handleInit = useCallback(
    (eng: FlowEngine) => {
      engineRef.current = eng;
      setEngine(eng);
      callbacks.onInit?.(eng);
    },
    [engineRef, callbacks],
  );

  const handleViewportChange = useCallback(
    (vp) => callbacks.onViewportChange?.(vp),
    [callbacks],
  );

  const handleEdgeSelect = useCallback(
    (id: string) => {
      const data = edgeByIdRef.current.get(id)?.data ?? { id };
      if (selectedEdgeIdRef.current === id && isMultiSelectModeRef.current) {
        setSelectedEdgeId(null);
        callbacks.onEdgeDeselect?.();
        return;
      }
      // one selection toolbar at a time
      if (selectedNodeIdsRef.current.length) setSelectedNodeIds([]);
      setSelectedEdgeId(id);
      callbacks.onEdgeSelect?.(id, data);
    },
    [callbacks, setSelectedEdgeId, setSelectedNodeIds],
  );

  // Tap on empty canvas clears node and edge selection
  const handleBackgroundTap = useCallback(() => {
    setBackgroundSelected(true);
    callbacks.onBackgroundClick?.();
    if (selectedNodeIdsRef.current.length) {
      setSelectedNodeIds([]);
      callbacks.onNodeDeselect?.();
    }
    if (selectedEdgeIdRef.current) {
      setSelectedEdgeId(null);
      callbacks.onEdgeDeselect?.();
    }
  }, [callbacks, setSelectedNodeIds, setSelectedEdgeId, setBackgroundSelected]);

  const handleBoxSelect = useCallback(
    (ids: string[]) => {
      const cur = selectedNodeIdsRef.current;
      const added = ids.filter((id) => !cur.includes(id));
      if (!added.length) return;
      setSelectedNodeIds([...cur, ...added]);
      for (const id of added)
        callbacks.onNodeSelect?.(
          id,
          nodeByIdRef.current.get(id)?.data ?? { id },
        );
    },
    [callbacks, setSelectedNodeIds],
  );

  const handleContainerSelect = useCallback(
    (id: string, modifiers?: import("../types").NodeSelectionModifiers) => {
      setSelectedNodeIds([id]);
      callbacks.onNodeSelect?.(
        id,
        nodeByIdRef.current.get(id)?.data ?? { id },
        modifiers,
      );
    },
    [callbacks, setSelectedNodeIds],
  );

  const handleEdgeDraw = useCallback(
    (source: string, target: string, properties?: FlowEdgeProperties) =>
      callbacks.onEdgeCreate?.(source, target, properties),
    [callbacks],
  );

  const handleDrawIntoSpace = useCallback(
    (
      sourceId: string,
      position: { x: number; y: number },
      sourceProperty?: string,
      reverse = false,
    ) => {
      if (
        edgeMode === "properties" &&
        callbacks.onNodeCreateRequest?.({
          sourceNodeId: sourceId,
          position,
          sourceProperty,
          reverse,
        }) === true
      )
        return;
      if (sourceProperty !== undefined || reverse) return;
      callbacks.onNodeCreate?.({
        type: "text",
        sourceNodeId: sourceId,
        position,
        isArrayMode: isArrayNodeModeRef.current,
      });
    },
    [callbacks, edgeMode],
  );

  const drawMode =
    !config.readOnly && isEdgeHandlesEnabled && config.edgeHandles !== false;
  const backgroundPattern =
    backgroundVariant === "transparent" ? "none" : backgroundVariant;

  return (
    <DotPatternBackground
      pattern={backgroundPattern}
      backgroundColor={effectiveBgColor}
    >
      <Box
        ref={containerRef}
        padding={0}
        width="100%"
        height="100%"
        flex={1}
        position="relative"
      >
        <Canvas
          nodes={canvasNodes}
          edges={canvasEdges}
          direction={layoutDirection}
          nodeAlignment={nodeAlignment}
          onContainerCollapse={(id) => {
            callbacks.onNodeCollapse?.(id, true);
            callbacks.onNodeViewToggle?.(id);
          }}
          selectedNodeIds={selectedNodeIds}
          edgeMode={edgeMode}
          compactPropertyLayout={compactPropertyLayout}
          edgeType={config.edgeType}
          edgeRadius={edgeRadius}
          customEdgeTypes={config.customEdgeTypes}
          edgeReveal={config.edgeReveal}
          rankSep={rankSep}
          edgeSep={edgeSep}
          spacingFactor={spacingFactor}
          compactSpacingScale={spacing}
          layoutDebounce={layoutDebounce}
          isPerformanceMode={isPerformanceMode}
          minZoom={config.minZoom ?? 0.01}
          maxZoom={config.maxZoom ?? 1.5}
          initialViewport={initialViewport}
          fitOnInit={!config.initialViewport}
          readOnly={!!config.readOnly}
          containerStyle={containerStyle}
          lineColor={edgeColor ? lineColor : connectorColor}
          drawMode={drawMode}
          drawHandles={!config.readOnly && config.edgeHandles !== false}
          dragMode={isDragMode}
          multiSelect={!!isMultiSelectMode}
          onInit={handleInit}
          onLayoutComplete={callbacks.onLayoutComplete}
          animateViewport={config.animateViewport}
          onViewportChange={handleViewportChange}
          onBackgroundTap={handleBackgroundTap}
          onBoxSelect={handleBoxSelect}
          onEdgeSelect={handleEdgeSelect}
          onContainerSelect={handleContainerSelect}
          onEdgeDraw={handleEdgeDraw}
          onDrawIntoSpace={handleDrawIntoSpace}
        />
      </Box>
    </DotPatternBackground>
  );
};

export default memo(FlowView);
