import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { FlowDiagramCallbacks, FlowDiagramConfig } from "../types";

export interface FlowDiagramContextValue {
  themeColor: string;
  edgeColor: string;
  colorMode: "light" | "dark";
  direction: string;
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
  cyRef: React.MutableRefObject<any>;
  callbacks: FlowDiagramCallbacks;
  config: FlowDiagramConfig;
  readOnly: boolean;
}

const FlowDiagramContext = createContext<FlowDiagramContextValue | null>(null);

export function useFlowDiagramContext() {
  const ctx = useContext(FlowDiagramContext);
  if (!ctx) throw new Error("useFlowDiagramContext must be used within FlowDiagram");
  return ctx;
}

export function FlowDiagramProvider({
  config,
  callbacks,
  children,
}: {
  config: FlowDiagramConfig;
  callbacks: FlowDiagramCallbacks;
  children: React.ReactNode;
}) {
  const cyRef = useRef<any>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isZoomMode, setIsZoomMode] = useState(true);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isDragMode, setIsDragMode] = useState(true);
  const [isEdgeHandlesEnabled, setIsEdgeHandlesEnabled] = useState(config.edgeHandles === true);
  const [isArrayNodeMode, setIsArrayNodeMode] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const stableCallbacks = useMemo(() => {
    const wrap = (key: string) => (...args: any[]) => (callbacksRef.current as any)?.[key]?.(...args);
    return {
      // Node events
      onNodeSelect: wrap("onNodeSelect"),
      onNodeDeselect: wrap("onNodeDeselect"),
      onNodeDoubleClick: wrap("onNodeDoubleClick"),
      onNodeCreate: wrap("onNodeCreate"),
      onNodeDelete: wrap("onNodeDelete"),
      onNodeLabelChange: wrap("onNodeLabelChange"),
      onNodeCollapse: wrap("onNodeCollapse"),
      onNodeColorChange: wrap("onNodeColorChange"),
      onNodeIconChange: wrap("onNodeIconChange"),
      onNodeHoverAction: wrap("onNodeHoverAction"),
      // Edge events
      onEdgeCreate: wrap("onEdgeCreate"),
      onEdgeSelect: wrap("onEdgeSelect"),
      onEdgeDeselect: wrap("onEdgeDeselect"),
      onEdgeRemove: wrap("onEdgeRemove"),
      onEdgeColorChange: wrap("onEdgeColorChange"),
      onEdgeLabelChange: wrap("onEdgeLabelChange"),
      onEdgeStyleChange: wrap("onEdgeStyleChange"),
      // Diagram events
      onViewportChange: wrap("onViewportChange"),
      onDirectionChange: wrap("onDirectionChange"),
      onArrayModeChange: wrap("onArrayModeChange"),
      onCyInit: wrap("onCyInit"),
    } as FlowDiagramCallbacks;
  }, []);

  const themeColor = config.themeColor || "blue.500";
  const edgeColor = config.edgeColor || "";
  const colorMode = config.colorMode || "light";
  const direction = config.direction || "LR";
  const readOnly = config.readOnly ?? false;

  // When consumer provides external mode values, use those over internal state
  const effectiveIsZoomMode = config.isZoomMode !== undefined ? config.isZoomMode : isZoomMode;
  const effectiveIsMultiSelectMode = config.isMultiSelectMode !== undefined ? config.isMultiSelectMode : isMultiSelectMode;
  const effectiveIsEdgeHandlesEnabled = config.isEdgeHandlesEnabled !== undefined ? config.isEdgeHandlesEnabled : isEdgeHandlesEnabled;
  const effectiveIsDragMode = config.isDragMode !== undefined ? config.isDragMode : isDragMode;

  const configRef = useRef(config);
  configRef.current = config;
  const stableConfig = useMemo(() => ({
    get direction() { return configRef.current.direction; },
    get themeColor() { return configRef.current.themeColor; },
    get colorMode() { return configRef.current.colorMode; },
    get readOnly() { return configRef.current.readOnly; },
    get editable() { return configRef.current.editable; },
    get minZoom() { return configRef.current.minZoom; },
    get maxZoom() { return configRef.current.maxZoom; },
    get backgroundPattern() { return configRef.current.backgroundPattern; },
    get edgeColor() { return configRef.current.edgeColor; },
    get backgroundColor() { return configRef.current.backgroundColor; },
    get edgeHandles() { return configRef.current.edgeHandles; },
    get initialViewport() { return configRef.current.initialViewport; },
    get nodeOverlayActions() { return configRef.current.nodeOverlayActions; },
    get renderNodeOverlay() { return configRef.current.renderNodeOverlay; },
    get renderSelectedNodeToolbar() { return configRef.current.renderSelectedNodeToolbar; },
    get renderSelectedEdgeToolbar() { return configRef.current.renderSelectedEdgeToolbar; },
    get renderBottomBar() { return configRef.current.renderBottomBar; },

    get customViews() { return configRef.current.customViews; },
    get disableKeyboardShortcuts() { return configRef.current.disableKeyboardShortcuts; },
    get isZoomMode() { return configRef.current.isZoomMode; },
    get isMultiSelectMode() { return configRef.current.isMultiSelectMode; },
    get isEdgeHandlesEnabled() { return configRef.current.isEdgeHandlesEnabled; },
    get isDragMode() { return configRef.current.isDragMode; },
  } as FlowDiagramConfig), []);

  const value: FlowDiagramContextValue = useMemo(() => ({
    themeColor,
    edgeColor,
    colorMode,
    direction,
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
    cyRef,
    callbacks: stableCallbacks,
    config: stableConfig,
    readOnly,
  }), [themeColor, edgeColor, colorMode, direction, selectedNodeIds, selectedEdgeId, effectiveIsZoomMode, effectiveIsMultiSelectMode, effectiveIsDragMode, effectiveIsEdgeHandlesEnabled, isArrayNodeMode, isPinned, isPerformanceMode, readOnly, stableCallbacks, stableConfig]);

  return (
    <FlowDiagramContext.Provider value={value}>
      {children}
    </FlowDiagramContext.Provider>
  );
}

export default FlowDiagramContext;
