import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { FlowEngine } from "../engine";
import type {
  FlowDiagramCallbacks,
  FlowDiagramConfig,
  FlowDiagramEdge,
  FlowDiagramNode,
  NodeAlignment,
  EdgeMode,
  ParentNodeStyle,
} from "../types";

export interface FlowDiagramContextValue {
  themeColor: string;
  edgeColor: string;
  colorMode: "light" | "dark";
  direction: string;
  nodeAlignment: NodeAlignment;
  edgeMode: EdgeMode;
  parentNodeStyle?: ParentNodeStyle;
  selectedNodeIds: string[];
  setSelectedNodeIds: (ids: string[]) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  isZoomMode: boolean;
  setIsZoomMode: (v: boolean) => void;
  isMultiSelectMode: boolean;
  setIsMultiSelectMode: (v: boolean) => void;
  isDragMode: boolean;
  setIsDragMode: (v: boolean) => void;
  isEdgeHandlesEnabled: boolean;
  setIsEdgeHandlesEnabled: (v: boolean) => void;
  isArrayNodeMode: boolean;
  setIsArrayNodeMode: (v: boolean) => void;
  isPinned: boolean;
  setIsPinned: (v: boolean) => void;
  isPerformanceMode: boolean;
  setIsPerformanceMode: (v: boolean) => void;
  engineRef: React.MutableRefObject<FlowEngine | null>;
  callbacks: FlowDiagramCallbacks;
  config: FlowDiagramConfig;
  readOnly: boolean;
}

const FlowDiagramContext = createContext<FlowDiagramContextValue | null>(null);

// Separate context: only the bottom bar needs data lookups, so node views don't re-render on data changes
const FlowDataContext = createContext<{
  nodeById: Map<string, FlowDiagramNode>;
  edgeById: Map<string, FlowDiagramEdge>;
  parentIds: Set<string>;
}>({
  nodeById: new Map(),
  edgeById: new Map(),
  parentIds: new Set(),
});

export function useFlowData() {
  return useContext(FlowDataContext);
}

export function useFlowDiagramContext() {
  const ctx = useContext(FlowDiagramContext);
  if (!ctx)
    throw new Error("useFlowDiagramContext must be used within FlowDiagram");
  return ctx;
}

export function FlowDiagramProvider({
  config,
  callbacks,
  nodes = [],
  edges = [],
  children,
}: {
  config: FlowDiagramConfig;
  callbacks: FlowDiagramCallbacks;
  nodes?: FlowDiagramNode[];
  edges?: FlowDiagramEdge[];
  children: React.ReactNode;
}) {
  const dataValue = useMemo(() => {
    const nodeById = new Map<string, FlowDiagramNode>();
    for (const n of nodes) if (n.data?.id) nodeById.set(n.data.id, n);
    const edgeById = new Map<string, FlowDiagramEdge>();
    for (const e of edges) if (e.data?.id) edgeById.set(e.data.id, e);
    const parentIds = new Set<string>();
    for (const n of nodes) if (n.data?.parent) parentIds.add(n.data.parent);
    return { nodeById, edgeById, parentIds };
  }, [nodes, edges]);

  const engineRef = useRef<FlowEngine | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isZoomMode, setIsZoomMode] = useState(true);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isDragMode, setIsDragMode] = useState(true);
  const [isEdgeHandlesEnabled, setIsEdgeHandlesEnabled] = useState(false);
  const [isArrayNodeMode, setIsArrayNodeMode] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const stableCallbacks = useMemo(() => {
    const wrap =
      (key: string) =>
      (...args: any[]) =>
        (callbacksRef.current as any)?.[key]?.(...args);
    return {
      // Node events
      onNodeSelect: wrap("onNodeSelect"),
      onNodeDeselect: wrap("onNodeDeselect"),
      onNodeDoubleClick: wrap("onNodeDoubleClick"),
      onNodeCreate: wrap("onNodeCreate"),
      onNodeDelete: wrap("onNodeDelete"),
      onNodeLabelChange: wrap("onNodeLabelChange"),
      onNodeContentChange: wrap("onNodeContentChange"),
      onNodeCollapse: wrap("onNodeCollapse"),
      onNodeColorChange: wrap("onNodeColorChange"),
      onNodeBorderColorChange: wrap("onNodeBorderColorChange"),
      onNodeBorderStyleChange: wrap("onNodeBorderStyleChange"),
      onNodeBorderWidthChange: wrap("onNodeBorderWidthChange"),
      onNodeIconChange: wrap("onNodeIconChange"),
      onNodeOutlineChange: wrap("onNodeOutlineChange"),
      onNodeAnimationChange: wrap("onNodeAnimationChange"),
      onNodeHoverAction: wrap("onNodeHoverAction"),
      // Edge events
      onEdgeCreate: wrap("onEdgeCreate"),
      onEdgeSelect: wrap("onEdgeSelect"),
      onEdgeDeselect: wrap("onEdgeDeselect"),
      onEdgeRemove: wrap("onEdgeRemove"),
      onEdgeDelete: wrap("onEdgeDelete"),
      onEdgeColorChange: wrap("onEdgeColorChange"),
      onEdgeLabelChange: wrap("onEdgeLabelChange"),
      onEdgeStyleChange: wrap("onEdgeStyleChange"),
      // Diagram events
      onViewportChange: wrap("onViewportChange"),
      onDirectionChange: wrap("onDirectionChange"),
      onArrayModeChange: wrap("onArrayModeChange"),
      onInit: wrap("onInit"),
      onJsonChange: wrap("onJsonChange"),
    } as FlowDiagramCallbacks;
  }, []);

  const themeColor = config.themeColor || "blue.500";
  const edgeColor = config.edgeColor || "";
  const colorMode = config.colorMode || "light";
  const direction = config.direction || "LR";
  const nodeAlignment = config.nodeAlignment ?? "center";
  const edgeMode = config.edgeMode === "workflow" ? "nodes" : (config.edgeMode ?? "nodes");
  const readOnly = config.readOnly ?? false;
  // Value-stable so inline literals don't re-render every consumer
  const parentNodeStyleKey = JSON.stringify(config.parentNodeStyle ?? null);
  const parentNodeStyle = useMemo(
    () => config.parentNodeStyle,
    [parentNodeStyleKey],
  );

  // When consumer provides external mode values, use those over internal state
  const effectiveIsZoomMode =
    config.isZoomMode !== undefined ? config.isZoomMode : isZoomMode;
  const effectiveIsMultiSelectMode =
    config.isMultiSelectMode !== undefined
      ? config.isMultiSelectMode
      : isMultiSelectMode;
  const effectiveIsEdgeHandlesEnabled =
    config.isEdgeHandlesEnabled !== undefined
      ? config.isEdgeHandlesEnabled
      : isEdgeHandlesEnabled;
  const effectiveIsDragMode =
    config.isDragMode !== undefined ? config.isDragMode : isDragMode;

  const configRef = useRef(config);
  configRef.current = config;
  const stableConfig = useMemo(
    () =>
      ({
        get direction() {
          return configRef.current.direction;
        },
        get nodeAlignment() {
          return configRef.current.nodeAlignment;
        },
        get edgeMode() {
          return configRef.current.edgeMode;
        },
        get themeColor() {
          return configRef.current.themeColor;
        },
        get colorMode() {
          return configRef.current.colorMode;
        },
        get readOnly() {
          return configRef.current.readOnly;
        },
        get editable() {
          return configRef.current.editable;
        },
        get minZoom() {
          return configRef.current.minZoom;
        },
        get maxZoom() {
          return configRef.current.maxZoom;
        },
        get backgroundPattern() {
          return configRef.current.backgroundPattern;
        },
        get edgeColor() {
          return configRef.current.edgeColor;
        },
        get parentNodeStyle() {
          return configRef.current.parentNodeStyle;
        },
        get backgroundColor() {
          return configRef.current.backgroundColor;
        },
        get edgeHandles() {
          return configRef.current.edgeHandles;
        },
        get initialViewport() {
          return configRef.current.initialViewport;
        },
        get nodeOverlayActions() {
          return configRef.current.nodeOverlayActions;
        },
        get renderNodeOverlay() {
          return configRef.current.renderNodeOverlay;
        },
        get renderSelectedNodeToolbar() {
          return configRef.current.renderSelectedNodeToolbar;
        },
        get renderSelectedEdgeToolbar() {
          return configRef.current.renderSelectedEdgeToolbar;
        },
        get renderBottomBar() {
          return configRef.current.renderBottomBar;
        },
        get selectionToolbar() {
          return configRef.current.selectionToolbar;
        },

        get customViews() {
          return configRef.current.customViews;
        },
        get disableKeyboardShortcuts() {
          return configRef.current.disableKeyboardShortcuts;
        },
        get isZoomMode() {
          return configRef.current.isZoomMode;
        },
        get isMultiSelectMode() {
          return configRef.current.isMultiSelectMode;
        },
        get isEdgeHandlesEnabled() {
          return configRef.current.isEdgeHandlesEnabled;
        },
        get isDragMode() {
          return configRef.current.isDragMode;
        },
      }) as FlowDiagramConfig,
    [],
  );

  const value: FlowDiagramContextValue = useMemo(
    () => ({
      themeColor,
      edgeColor,
      colorMode,
      direction,
      nodeAlignment,
      edgeMode,
      parentNodeStyle,
      selectedNodeIds,
      setSelectedNodeIds,
      selectedEdgeId,
      setSelectedEdgeId,
      isZoomMode: effectiveIsZoomMode,
      setIsZoomMode,
      isMultiSelectMode: effectiveIsMultiSelectMode,
      setIsMultiSelectMode,
      isDragMode: effectiveIsDragMode,
      setIsDragMode,
      isEdgeHandlesEnabled: effectiveIsEdgeHandlesEnabled,
      setIsEdgeHandlesEnabled,
      isArrayNodeMode,
      setIsArrayNodeMode,
      isPinned,
      setIsPinned,
      isPerformanceMode,
      setIsPerformanceMode,
      engineRef,
      callbacks: stableCallbacks,
      config: stableConfig,
      readOnly,
    }),
    [
      themeColor,
      edgeColor,
      colorMode,
      direction,
      nodeAlignment,
      edgeMode,
      parentNodeStyle,
      selectedNodeIds,
      selectedEdgeId,
      effectiveIsZoomMode,
      effectiveIsMultiSelectMode,
      effectiveIsDragMode,
      effectiveIsEdgeHandlesEnabled,
      isArrayNodeMode,
      isPinned,
      isPerformanceMode,
      readOnly,
      config.edgeHandles,
      stableCallbacks,
      stableConfig,
    ],
  );

  return (
    <FlowDiagramContext.Provider value={value}>
      <FlowDataContext.Provider value={dataValue}>
        {children}
      </FlowDataContext.Provider>
    </FlowDiagramContext.Provider>
  );
}

export default FlowDiagramContext;
