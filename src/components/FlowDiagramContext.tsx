import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FlowEngine } from "../engine";
import type { NodeGridOptions } from "../engine/nodeCollisions";
import type {
  BackgroundVariant,
  EdgeMode,
  FlowDiagramCallbacks,
  FlowDiagramConfig,
  FlowDiagramEdge,
  FlowDiagramNode,
  NodeAlignment,
  NodeSpacing,
  NodeViewMode,
  ParentNodeStyle,
} from "../types";

export interface FlowDiagramContextValue {
  allNodesIconLabel: boolean;
  setAllNodesIconLabel: (enabled: boolean) => void;
  nodeViewModes: Record<string, NodeViewMode>;
  setNodeViewMode: (nodeId: string, mode: NodeViewMode) => void;
  nodeRadiusPreviews: Record<string, number>;
  setNodeRadiusPreview: (ids: string[], radius: number | undefined) => void;
  spacing: number;
  edgeRadius: number | undefined;
  setEdgeRadius: (radius: number) => void;
  setSpacing: (spacing: NodeSpacing) => void;
  backgroundVariant: BackgroundVariant;
  setBackgroundVariant: (variant: BackgroundVariant) => void;
  setEdgeMode: (mode: EdgeMode) => void;
  compactPropertyLayout: boolean;
  setCompactPropertyLayout: (enabled: boolean) => void;
  workflowContract?: import("../core/workflowContract").WorkflowContract;
  setWorkflowContract: (
    contract: import("../core/workflowContract").WorkflowContract | undefined,
  ) => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  backgroundSelected: boolean;
  setBackgroundSelected: (selected: boolean) => void;
  edgeColor: string;
  setEdgeColor: (color: string) => void;
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
  nodeGridOptions: NodeGridOptions | null;
  setNodeGridOptions: (options: NodeGridOptions | null) => void;
  lastNodeGridOptions: NodeGridOptions;
  fillRadiusEditedIds: ReadonlySet<string>;
  setFillRadiusEditedIds: (ids: Set<string>) => void;
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
  const [nodeGridOptions, setLocalNodeGridOptions] =
    useState<NodeGridOptions | null>(null);
  const nodeGridOptionsRef = useRef(nodeGridOptions);
  const [lastNodeGridOptions, setLastNodeGridOptions] =
    useState<NodeGridOptions>({ gaps: 15, fill: false, padding: 0 });
  const [fillRadiusEditedIds, setFillRadiusEditedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const setNodeGridOptions = useCallback((options: NodeGridOptions | null) => {
    if (!!options?.fill !== !!nodeGridOptionsRef.current?.fill)
      setFillRadiusEditedIds(new Set());
    nodeGridOptionsRef.current = options;
    if (options) setLastNodeGridOptions(options);
    setLocalNodeGridOptions(options);
  }, []);
  const [localEdgeMode, setEdgeMode] = useState<EdgeMode>("auto");
  const [localCompactPropertyLayout, setCompactPropertyLayout] =
    useState(false);
  const compactPropertyLayout =
    config.compactPropertyLayout ?? localCompactPropertyLayout;
  const [localNodeViewModes, setLocalNodeViewModes] = useState<
    Record<string, NodeViewMode>
  >({});
  const nodeViewModes = config.nodeViewModes ?? localNodeViewModes;
  const [localAllNodesIconLabel, setLocalAllNodesIconLabel] = useState<
    boolean | undefined
  >(config.allNodesIconLabel);
  useEffect(
    () => setLocalAllNodesIconLabel(config.allNodesIconLabel),
    [config.allNodesIconLabel],
  );
  const [nodeRadiusPreviews, setNodeRadiusPreviews] = useState<
    Record<string, number>
  >({});
  const setNodeRadiusPreview = useCallback(
    (ids: string[], radius: number | undefined) => {
      setNodeRadiusPreviews((current) => {
        const next = { ...current };
        for (const id of ids) {
          if (radius === undefined) delete next[id];
          else next[id] = radius;
        }
        return next;
      });
    },
    [],
  );
  const iconLabelNodes = [...dataValue.nodeById.values()].filter(
    (node) =>
      dataValue.parentIds.has(node.data.id) ||
      node.data.config?.parentContainer ||
      node.data.type === "objectView" ||
      node.data.type === "arrayView" ||
      node.data.type === "grid",
  );
  const inferredIconLabel = iconLabelNodes.every((node) =>
    dataValue.parentIds.has(node.data.id) || node.data.config?.parentContainer
      ? !!node.data.config?.collapsed
      : nodeViewModes[node.data.id] === "icon-label" ||
        (node.data.type === "grid" &&
          nodeViewModes[node.data.id] === undefined) ||
        (node.data.config?.labelBelow &&
          nodeViewModes[node.data.id] !== "properties"),
  );
  const allNodesIconLabel =
    localAllNodesIconLabel ?? config.allNodesIconLabel ?? inferredIconLabel;
  const [localSpacing, setSpacing] = useState<NodeSpacing>("normal");
  const [localEdgeRadius, setEdgeRadius] = useState<number>();
  const requestedEdgeRadius = config.edgeRadius ?? localEdgeRadius;
  const edgeRadius =
    requestedEdgeRadius !== undefined && Number.isFinite(requestedEdgeRadius)
      ? Math.min(500, Math.max(0, requestedEdgeRadius))
      : undefined;
  const [localBackgroundVariant, setBackgroundVariant] =
    useState<BackgroundVariant>();
  const requestedSpacing = config.spacing ?? localSpacing;
  const spacing =
    typeof requestedSpacing === "number"
      ? Number.isFinite(requestedSpacing)
        ? Math.min(2, Math.max(0.5, requestedSpacing))
        : 1
      : requestedSpacing === "compact"
        ? 0.5
        : requestedSpacing === "spacious"
          ? 2
          : 1;
  const backgroundVariant =
    config.backgroundVariant ??
    localBackgroundVariant ??
    (config.backgroundPattern === "none" &&
    config.backgroundColor === "transparent"
      ? "transparent"
      : (config.backgroundPattern ?? "dot"));
  const [localContract, setWorkflowContract] =
    useState<import("../core/workflowContract").WorkflowContract>();
  const workflowContract = Object.prototype.hasOwnProperty.call(
    config,
    "workflowContract",
  )
    ? config.workflowContract
    : localContract;
  const [localThemeColor, setThemeColor] = useState("blue.500");
  const [backgroundSelected, setBackgroundSelected] = useState(false);

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
      onNodesCopy: wrap("onNodesCopy"),
      onNodesDuplicate: wrap("onNodesDuplicate"),
      onBackgroundClick: wrap("onBackgroundClick"),
      onBottomBarCollapsedChange: wrap("onBottomBarCollapsedChange"),
      onNodeGridZoomOut: wrap("onNodeGridZoomOut"),
      onNodeGridFillRequest: wrap("onNodeGridFillRequest"),
      onNodeGridModeRequest: wrap("onNodeGridModeRequest"),
      onNodeGridDrop: wrap("onNodeGridDrop"),
      onNodeParentChange: wrap("onNodeParentChange"),
      onNodeDeselect: wrap("onNodeDeselect"),
      onNodeDoubleClick: wrap("onNodeDoubleClick"),
      onNodeViewToggle: wrap("onNodeViewToggle"),
      onNodeTypeViewChange: wrap("onNodeTypeViewChange"),
      onNodeCreate: wrap("onNodeCreate"),
      onNodeCreateRequest: wrap("onNodeCreateRequest"),
      onNodeDelete: wrap("onNodeDelete"),
      onNodeLabelChange: wrap("onNodeLabelChange"),
      onNodeSubtitleChange: wrap("onNodeSubtitleChange"),
      onNodeContentChange: wrap("onNodeContentChange"),
      onNodeCollapse: wrap("onNodeCollapse"),
      onNodeColorChange: wrap("onNodeColorChange"),
      onNodeBorderColorChange: wrap("onNodeBorderColorChange"),
      onNodeBorderStyleChange: wrap("onNodeBorderStyleChange"),
      onNodeBorderWidthChange: wrap("onNodeBorderWidthChange"),
      onNodeBorderRadiusChange: (id: string, radius: number | undefined) => {
        if (nodeGridOptionsRef.current?.fill)
          setFillRadiusEditedIds((previous) => new Set([...previous, id]));
        callbacksRef.current.onNodeBorderRadiusChange?.(id, radius);
      },
      onNodeIconChange: wrap("onNodeIconChange"),
      onNodeOutlineChange: wrap("onNodeOutlineChange"),
      onNodeAnimationChange: wrap("onNodeAnimationChange"),
      onNodeAnimationVariantChange: wrap("onNodeAnimationVariantChange"),
      onEdgeAnimationVariantChange: wrap("onEdgeAnimationVariantChange"),
      onNodeHoverAction: wrap("onNodeHoverAction"),
      // Edge events
      onEdgeCreate: wrap("onEdgeCreate"),
      onEdgeSelect: wrap("onEdgeSelect"),
      onEdgeDeselect: wrap("onEdgeDeselect"),
      onEdgeRemove: wrap("onEdgeRemove"),
      onEdgeDelete: wrap("onEdgeDelete"),
      onEdgeColorChange: wrap("onEdgeColorChange"),
      onEdgeTypeChange: wrap("onEdgeTypeChange"),
      onEdgeIconChange: wrap("onEdgeIconChange"),
      onEdgeLabelChange: wrap("onEdgeLabelChange"),
      onEdgeStyleChange: wrap("onEdgeStyleChange"),
      // Diagram events
      onViewportChange: wrap("onViewportChange"),
      onDirectionChange: wrap("onDirectionChange"),
      onThemeColorChange: wrap("onThemeColorChange"),
      onSpacingChange: wrap("onSpacingChange"),
      onEdgeRadiusChange: wrap("onEdgeRadiusChange"),
      onBackgroundVariantChange: wrap("onBackgroundVariantChange"),
      onEdgeModeChange: wrap("onEdgeModeChange"),
      onCompactPropertyLayoutChange: wrap("onCompactPropertyLayoutChange"),
      onWorkflowContractChange: wrap("onWorkflowContractChange"),
      onWorkflowConfigurationOpen: callbacks.onWorkflowConfigurationOpen
        ? wrap("onWorkflowConfigurationOpen")
        : undefined,
      onArrayModeChange: wrap("onArrayModeChange"),
      onInit: wrap("onInit"),
      onLayoutComplete: wrap("onLayoutComplete"),
      onJsonChange: wrap("onJsonChange"),
    } as FlowDiagramCallbacks;
  }, []);

  const themeColor = config.themeColor || localThemeColor;
  const [localEdgeColor, setLocalEdgeColor] = useState("");
  const edgeColor = config.edgeColor ?? localEdgeColor;
  const colorMode = config.colorMode || "light";
  const direction = config.direction || "LR";
  const nodeAlignment = config.nodeAlignment ?? "center";
  const edgeMode =
    config.edgeMode === "workflow"
      ? "nodes"
      : (config.edgeMode ?? localEdgeMode);
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
        get compactPropertyLayout() {
          return configRef.current.compactPropertyLayout;
        },
        get bottomBarCollapsed() {
          return configRef.current.bottomBarCollapsed;
        },
        get bottomBarNavigation() {
          return configRef.current.bottomBarNavigation;
        },
        get edgeType() {
          return configRef.current.edgeType;
        },
        get edgeReveal() {
          return configRef.current.edgeReveal;
        },
        get customEdgeTypes() {
          return configRef.current.customEdgeTypes;
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
        get animateViewport() {
          return configRef.current.animateViewport;
        },
        get disableAnimations() {
          return configRef.current.disableAnimations;
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
        get bottomBarExtra() {
          return configRef.current.bottomBarExtra;
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

  const setNodeViewMode = useCallback(
    (nodeId: string, mode: NodeViewMode) => {
      if (mode !== "default" && mode !== "properties" && mode !== "icon-label")
        throw new Error("Unknown node view mode.");
      setLocalAllNodesIconLabel((current) => current ?? allNodesIconLabel);
      setLocalNodeViewModes((current) =>
        current[nodeId] === mode ? current : { ...current, [nodeId]: mode },
      );
      callbacks.onNodeViewModeChange?.(nodeId, mode);
    },
    [callbacks.onNodeViewModeChange, allNodesIconLabel],
  );

  const value: FlowDiagramContextValue = useMemo(
    () => ({
      allNodesIconLabel,
      setAllNodesIconLabel: (enabled) => {
        setLocalAllNodesIconLabel(enabled);
        if (!enabled)
          for (const [id, mode] of Object.entries(nodeViewModes))
            if (mode === "icon-label" && !dataValue.nodeById.has(id))
              setNodeViewMode(id, "default");
        for (const node of iconLabelNodes) {
          if (
            dataValue.parentIds.has(node.data.id) ||
            node.data.config?.parentContainer
          ) {
            if (!readOnly && !!node.data.config?.collapsed !== enabled)
              callbacks.onNodeCollapse?.(node.data.id, enabled);
          } else
            setNodeViewMode(
              node.data.id,
              enabled
                ? "icon-label"
                : node.data.config?.labelBelow
                  ? "properties"
                  : "default",
            );
        }
        callbacks.onAllNodesIconLabelChange?.(enabled);
      },
      nodeViewModes,
      setNodeViewMode,
      nodeRadiusPreviews,
      setNodeRadiusPreview,
      spacing,
      setSpacing,
      edgeRadius,
      setEdgeRadius,
      backgroundVariant,
      setBackgroundVariant,
      themeColor,
      setThemeColor,
      backgroundSelected,
      setBackgroundSelected,
      edgeColor,
      setEdgeColor: (color) => {
        setLocalEdgeColor(color);
        callbacks.onGraphEdgeColorChange?.(color);
      },
      colorMode,
      direction,
      nodeAlignment,
      edgeMode,
      setEdgeMode,
      compactPropertyLayout,
      setCompactPropertyLayout,
      workflowContract,
      setWorkflowContract,
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
      nodeGridOptions,
      setNodeGridOptions,
      lastNodeGridOptions,
      fillRadiusEditedIds,
      setFillRadiusEditedIds,
      engineRef,
      callbacks: stableCallbacks,
      config: stableConfig,
      readOnly,
    }),
    [
      allNodesIconLabel,
      dataValue,
      setNodeViewMode,
      callbacks.onNodeCollapse,
      callbacks.onAllNodesIconLabelChange,
      callbacks.onGraphEdgeColorChange,
      nodeViewModes,
      callbacks.onNodeViewModeChange,
      nodeRadiusPreviews,
      setNodeRadiusPreview,
      themeColor,
      spacing,
      backgroundVariant,
      edgeRadius,
      config.backgroundColor,
      backgroundSelected,
      edgeColor,
      colorMode,
      direction,
      nodeAlignment,
      edgeMode,
      workflowContract,
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
      nodeGridOptions,
      lastNodeGridOptions,
      fillRadiusEditedIds,
      readOnly,
      config.edgeHandles,
      config.edgeType,
      config.edgeReveal,
      config.animateViewport,
      config.disableAnimations,
      config.customEdgeTypes,
      config.selectionToolbar,
      config.bottomBarExtra,
      config.bottomBarCollapsed,
      config.bottomBarNavigation,
      config.compactPropertyLayout,
      compactPropertyLayout,
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
