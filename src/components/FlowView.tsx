import { memo, useEffect, useRef, useMemo, useCallback } from "react";
import { Box } from "@chakra-ui/react";
import DotPatternBackground from "./DotPattern";
import DefaultViews from "../nodes/nodeViews";
import { chartStyles } from "../cytoscape/chartStyles";
import { useCustomColors, useThemeContentColors } from "../theme/useCustomColors";
import { getChakraColorHex } from "../theme/colorUtils";
import { calculateOptimalSpacing } from "../core/layoutCalculations";
import { Edge, Graph, Node } from "../cytoscape";
import { dagreLayout } from "../cytoscape/layouts";
import { BASE_CY_PARAMS, LARGE_GRAPH_CY_PARAMS, PERF_CY_PARAMS } from "../cytoscape/cyParams";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import type { FlowDiagramNode, FlowDiagramEdge } from "../types";

interface FlowViewProps {
  nodes: FlowDiagramNode[];
  edges: FlowDiagramEdge[];
}

const FlowView = ({ nodes, edges }: FlowViewProps) => {
  const {
    themeColor, edgeColor, direction, cyRef, callbacks, config,
    selectedNodeIds, setSelectedNodeIds, setSelectedEdgeId,
    setIsPerformanceMode,
    isZoomMode, setIsZoomMode,
    isMultiSelectMode, setIsMultiSelectMode,
    isDragMode, setIsDragMode,
    isEdgeHandlesEnabled,
    isArrayNodeMode,
  } = useFlowDiagramContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const ehRef = useRef<any>(null);
  const isArrayNodeModeRef = useRef(isArrayNodeMode);

  const isPerformanceMode = nodes.length > 200;
  useEffect(() => { setIsPerformanceMode(isPerformanceMode); }, [isPerformanceMode, setIsPerformanceMode]);

  const { edgeSep, rankSep } = useMemo(() => calculateOptimalSpacing(nodes.length), [nodes.length]);

  const { bgColor: highlightColor } = useThemeContentColors(themeColor);
  const { background: bgColor, borderSecondary: borderColor } = useCustomColors();

  const effectiveBgColor = config.backgroundColor || bgColor;

  const getColorHex = useCallback(
    (color) => {
      if (color?.includes("gray")) return "whitesmoke";
      if (!color) return getChakraColorHex(themeColor);
      switch (color) {
        case "dark": return getChakraColorHex(effectiveBgColor);
        case "light": return getChakraColorHex(borderColor);
        default: return getChakraColorHex(color);
      }
    },
    [themeColor, effectiveBgColor, borderColor],
  );

  const isDark = config.colorMode === "dark";
  const autoLineColor = useMemo(() => (!isDark ? "dark" : getColorHex(highlightColor)), [isDark, highlightColor, getColorHex]);
  const lineColor = edgeColor ? getColorHex(edgeColor) : autoLineColor;
  const chartStylesMemoized = useMemo(() => chartStyles(getColorHex), [getColorHex]);

  const viewport = config.initialViewport || { pan: { x: 0, y: 0 }, zoom: 0.01 };

  const cyParams = useMemo(() => {
    const baseParams = isPerformanceMode ? PERF_CY_PARAMS : nodes.length > 100 ? LARGE_GRAPH_CY_PARAMS : BASE_CY_PARAMS;

    return {
      ...baseParams,
      style: chartStylesMemoized,
      zoom: viewport.zoom,
      pan: viewport.pan,
      minZoom: config.minZoom ?? 0.01,
      maxZoom: config.maxZoom ?? 1.5,
      userZoomingEnabled: false,
      userPanningEnabled: false,
    };
  }, [chartStylesMemoized, viewport, nodes.length, config.minZoom, config.maxZoom]);

  const hasLayoutRunRef = useRef(false);
  const layoutSettleTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { clearTimeout(layoutSettleTimerRef.current); };
  }, []);

  const layoutParams = useMemo(() => ({
    ...dagreLayout,
    ...(direction && { rankDir: direction }),
    edgeSep,
    rankSep,
    get animate() { return hasLayoutRunRef.current && !isPerformanceMode; },
    animationDuration: 300,
    animationEasing: "ease-in-out-cubic",
    stop: () => {
      if (cyRef.current) {
        if (!hasLayoutRunRef.current) {
          setTimeout(() => {
            cyRef.current?.fit(undefined, 50);
          }, 100);
        }
        clearTimeout(layoutSettleTimerRef.current);
        layoutSettleTimerRef.current = setTimeout(() => {
          hasLayoutRunRef.current = true;
        }, 500);
      }
    },
  }), [direction, edgeSep, rankSep, cyRef, isPerformanceMode]);

  const applyParentNodeStyles = useCallback(
    (nodeColor?: string) => {
      const c = nodeColor ? getColorHex(nodeColor) : getColorHex(themeColor);
      return {
        "corner-radius": 50,
        "background-color": c,
        color: c,
        "border-color": c,
      };
    },
    [themeColor, getColorHex],
  );

  const applyEdgeStyles = useCallback(
    (edge, source, target, edgeData?) => {
      let style: any = {};

      if (edgeData?.isInverted && edgeData?.source === source) {
        style["target-arrow-shape"] = "none";
        style["source-arrow-shape"] = "triangle";
      }

      if (edgeData?.isEdgeAnimated) {
        style["line-style"] = "dashed";
        style["line-dash-pattern"] = [32, 18];
        style["line-dash-offset"] = 0;
      } else if (edgeData?.isEdgeDashed) {
        style["line-style"] = "dashed";
        style["line-dash-pattern"] = [];
        style["line-dash-offset"] = 0;
      } else {
        style["line-style"] = "solid";
        style["line-dash-pattern"] = [];
        style["line-dash-offset"] = 0;
      }

      if (direction === "TB") style["taxi-direction"] = "downward";
      if (direction === "BT") style["taxi-direction"] = "upward";
      if (direction === "LR") style["taxi-direction"] = "rightward";
      if (direction === "RL") style["taxi-direction"] = "leftward";

      style["line-color"] = lineColor;
      style["color"] = lineColor;
      style["target-arrow-color"] = lineColor;
      style["source-arrow-color"] = lineColor;

      return style;
    },
    [lineColor, direction],
  );

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const applyParentNodeStylesRef = useRef(applyParentNodeStyles);
  applyParentNodeStylesRef.current = applyParentNodeStyles;
  const applyEdgeStylesRef = useRef(applyEdgeStyles);
  applyEdgeStylesRef.current = applyEdgeStyles;

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const onAdd = () => {
      cy.nodes().forEach((node) => {
        if (node.isParent()) {
          const nd = nodesRef.current.find((n) => n.data?.id === node.id());
          node.style(applyParentNodeStylesRef.current(nd?.data?.viewProps?.bgColor));
        }
      });
    };
    cy.on("add", onAdd);
    return () => { cy.off("add", onAdd); };
  }, []);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.nodes().forEach((node) => {
      if (node.isParent()) {
        const nd = nodes.find((n) => n.data?.id === node.id());
        node.style(applyParentNodeStyles(nd?.data?.viewProps?.bgColor));
      }
    });
    edges.forEach(({ data }) => {
      const cyEdge = cy.getElementById(data.id);
      if (!cyEdge?.length) return;
      cyEdge.data({ isEdgeAnimated: data.isEdgeAnimated, isEdgeDashed: data.isEdgeDashed });
      cyEdge.style(applyEdgeStyles(cyEdge, data.source, data.target, data));
    });
  }, [nodes, edges, lineColor, applyParentNodeStyles, applyEdgeStyles]);

  const configRef = useRef(config);
  configRef.current = config;
  const isZoomModeRef = useRef(isZoomMode);
  isZoomModeRef.current = isZoomMode;
  const isEdgeHandlesEnabledRef = useRef(isEdgeHandlesEnabled);
  isEdgeHandlesEnabledRef.current = isEdgeHandlesEnabled;
  isArrayNodeModeRef.current = isArrayNodeMode;

  useEffect(() => {
    if (!cyRef.current || !cyRef.current.container) return;

    const cy = cyRef.current;
    const el = containerRef.current;
    if (!el) return;
    let panRafId: number | null = null;
    let zoomRafId: number | null = null;
    let accPanDX = 0;
    let accPanDY = 0;
    let accZoomDY = 0;
    let lastZoomClientX = 0;
    let lastZoomClientY = 0;

    const wheelHandler = (e: WheelEvent) => {
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
            const zoom = cy.zoom();
            const dy = accZoomDY;
            accZoomDY = 0;

            let newZoom = zoom - (dy * 0.05) / 100;
            newZoom = Math.max(cfg.minZoom ?? 0.01, Math.min(cfg.maxZoom ?? 1.5, newZoom));
            const rect = el.getBoundingClientRect();
            cy.zoom({ level: newZoom, renderedPosition: { x: lastZoomClientX - rect.left, y: lastZoomClientY - rect.top } });
          });
        }
      } else {
        accPanDX += e.deltaX;
        accPanDY += e.deltaY;

        if (panRafId === null) {
          panRafId = requestAnimationFrame(() => {
            panRafId = null;
            const pan = cy.pan();
            const zoom = cy.zoom();
            const panSpeed = 0.35;
            const dx = accPanDX;
            const dy = accPanDY;
            accPanDX = 0;
            accPanDY = 0;

            cy.pan({ x: pan.x + (-dx * panSpeed) / zoom, y: pan.y + (-dy * panSpeed) / zoom });
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
  }, [cyRef.current]);

  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.userPanningEnabled(isDragMode);
    }
  }, [isDragMode]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.boxSelectionEnabled(!!isMultiSelectMode);
    cy.selectionType(isMultiSelectMode ? "additive" : "single");
    cy.userPanningEnabled(!isMultiSelectMode && isDragMode);
  }, [isMultiSelectMode, isDragMode]);

  useEffect(() => {
    if (!ehRef.current) return;
    if (isEdgeHandlesEnabled) {
      ehRef.current.enableDrawMode();
    } else {
      ehRef.current.disableDrawMode();
    }
  }, [isEdgeHandlesEnabled]);

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;

  useEffect(() => {
    if (config.disableKeyboardShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "z" || e.key === "Z") setIsZoomMode(!isZoomModeRef.current);
      if (e.key === "m" || e.key === "M") setIsMultiSelectMode(!isMultiSelectMode);
      if (e.key === "d" || e.key === "D") setIsDragMode(!isDragMode);

      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeIdsRef.current.length > 0) {
        e.preventDefault();
        const ids = selectedNodeIdsRef.current.filter((id) => id !== "root");
        if (ids.length === 0) return;
        const cy = cyRef.current;
        for (const nodeId of ids) {
          const nodeData = cy?.getElementById(nodeId)?.data();
          callbacks.onNodeDelete?.(nodeId, nodeData || {});
        }
        setSelectedNodeIds([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMultiSelectMode, isDragMode, setIsZoomMode, setIsMultiSelectMode, setIsDragMode, config.disableKeyboardShortcuts, callbacks, setSelectedNodeIds, cyRef]);

  useEffect(() => {
    return () => {
      if (cyRef.current) {
        try { cyRef.current.removeAllListeners(); } catch {}
      }
    };
  }, []);

  const layoutDebounce = useMemo(() => {
    if (isPerformanceMode) return 300;
    if (nodes.length > 50) return 150;
    if (nodes.length > 20) return 100;
    return 50;
  }, [nodes.length, isPerformanceMode]);

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
      if (e.data?.source && !map.has(e.data.source)) map.set(e.data.source, e.data);
    }
    return map;
  }, [edges]);

  const backgroundPattern = config.backgroundPattern || "dot";

  return (
    <DotPatternBackground pattern={backgroundPattern} backgroundColor={config.backgroundColor}>
      <Box ref={containerRef} padding={0} width="100%" height="100%" flex={1} position="relative">
        <Graph
          cyParams={cyParams}
          layoutParams={layoutParams}
          layoutDebounce={layoutDebounce}
          onCyInit={(cy) => {
            cyRef.current = cy;
            callbacks.onCyInit?.(cy);

            let vpRafId: number | null = null;
            cy.on("zoom pan", () => {
              if (vpRafId !== null) return;
              vpRafId = requestAnimationFrame(() => {
                vpRafId = null;
                callbacks.onViewportChange?.({
                  zoom: cy.zoom(),
                  pan: cy.pan(),
                });
              });
            });

            cy.on("select", "edge", (e) => {
              const edge = e.target;
              setSelectedEdgeId(edge.id());
              callbacks.onEdgeSelect?.(edge.id(), edge.data());
            });
            cy.on("unselect", "edge", () => {
              setSelectedEdgeId(null);
              callbacks.onEdgeDeselect?.();
            });
            cy.on("remove", "edge", (e) => {
              const edge = e.target;
              callbacks.onEdgeRemove?.(edge.id(), edge.data());
            });

            cy.on("tap", ":parent", (e) => {
              const node = e.target;
              setSelectedNodeIds([node.id()]);
              callbacks.onNodeSelect?.(node.id(), node.data());
            });

            if (config.edgeHandles !== false) {
              const defaults = {
                canConnect: (src, tgt) => !src.same(tgt),
                edgeParams: (src, tgt) => ({
                  data: { source: src.id(), target: tgt.id(), label: "" },
                }),
                loopAllowed: () => false,
                hoverDelay: 500,
                snap: false,
                snapThreshold: 10,
                snapFrequency: 5,
                noEdgeEventsInDraw: true,
                disableBrowserGestures: true,
                handlePosition: "left",
                handleNodes: "node",
                handleSize: 20,
                handleColor: themeColor || "#0ea5e9",
                handleOutlineColor: "#B92020FF",
                handleOutlineWidth: 2,
                handleLineType: "ghost",
                handleLineWidth: 2,
                preview: true,
                ghostEdgeParams: () => ({}),
                edgeType: () => "flat",
                nodeParams: () => ({}),
              };
              const eh = cy.edgehandles(defaults);
              ehRef.current = eh;
              if (isEdgeHandlesEnabledRef.current) {
                eh.enableDrawMode();
              }

              let drawStartPos: { x: number; y: number } | null = null;
              let sourceNode: any = null;

              cy.on("ehstart", (event, srcNode) => {
                sourceNode = srcNode;
                const me = (event.originalEvent || (window as any).event) as MouseEvent;
                if (me?.clientX && me?.clientY) {
                  drawStartPos = { x: me.clientX, y: me.clientY };
                } else {
                  const pos = srcNode.renderedPosition();
                  drawStartPos = { x: pos.x, y: pos.y };
                }
              });

              cy.on("ehcancel", (event) => {
                if (!drawStartPos || !sourceNode) return;
                const mouseEvent = (event.originalEvent || (window as any).event) as MouseEvent;
                const mouseX = mouseEvent?.clientX;
                const mouseY = mouseEvent?.clientY;

                if (mouseX && mouseY && callbacks.onNodeCreate) {
                  const deltaX = Math.abs(mouseX - drawStartPos.x);
                  const deltaY = Math.abs(mouseY - drawStartPos.y);

                  if (Math.max(deltaX, deltaY) > 30) {
                    const modelPos = cy.renderer().projectIntoViewport(mouseX, mouseY);
                    callbacks.onNodeCreate({
                      type: "text",
                      sourceNodeId: sourceNode.id(),
                      position: { x: modelPos[0], y: modelPos[1] },
                      isArrayMode: isArrayNodeModeRef.current,
                    });
                  }
                }
                drawStartPos = null;
                sourceNode = null;
              });

              cy.on("ehcomplete", (_event, src, tgt) => {
                callbacks.onEdgeCreate?.(src.id(), tgt.id());
              });
              cy.on("ehstop", () => { drawStartPos = null; sourceNode = null; });
            }
          }}
        >
          {(nodes || []).map((node) => {
            const Views = config.customViews || DefaultViews;
            const isParentContainer = parentIds.has(node.data?.id) && !node.data?.parent;
            const nodeLabel = isParentContainer ? node.data?.label || node.data?.headerTitle || "Container" : undefined;
            const ViewComponent = isParentContainer ? Views.parentContainer : Views[node?.data.type] || Views.text;
            const edgeData = edgeBySource.get(node.data?.id);

            return (
              <Node key={node.data?.id} id={node.data?.id} parent={node.data?.parent} label={nodeLabel} styleCallback={() => applyParentNodeStyles(node.data?.viewProps?.bgColor)}>
                <ViewComponent {...node} isInverted={edgeData?.isInverted} isParent={isParentContainer} key={`${node.data?.id}-${themeColor}`} />
              </Node>
            );
          })}
          {(edges || []).map(({ data }) => (
            <Edge
              id={data?.id}
              key={data?.id}
              source={data?.source}
              target={data?.target}
              label={data?.label}
              isPerformanceMode={isPerformanceMode}
              styleCallback={(edge, source, target) => applyEdgeStyles(edge, source, target, data)}
            />
          ))}
        </Graph>
      </Box>
    </DotPatternBackground>
  );
};

export default memo(FlowView);
