export enum FlowType {
  TOP_DOWN = "TB",
  BOTTOM_UP = "BT",
  LEFT_RIGHT = "LR",
  RIGHT_LEFT = "RL",
  CENTER = "C",
}

/** "C" = center: root in the middle, children fan out both ways (generate with `isCntr: true`); laid out as LR */
export type FlowDirection = "LR" | "RL" | "TB" | "BT" | "C";
export type LayoutAlgorithm = "dagre" | "elk" | "tidytree" | "concentric" | "cose";
export type BackgroundPattern = "dot" | "steel" | "grid" | "none";

export interface FlowDiagramNode {
  data: {
    id: string;
    label?: string;
    text?: string;
    code?: string;
    type: string;
    parent?: string;
    headerTitle?: string;
    description?: Record<string, any>;
    viewProps?: any;
    config?: Record<string, any>;
  };
}

export interface FlowDiagramEdge {
  data: {
    id: string;
    source: string;
    target: string;
    label?: string;
    isInverted?: boolean;
    isEdgeAnimated?: boolean;
    isEdgeDashed?: boolean;
  };
}

/** Actions shown in the hover overlay above nodes */
export interface NodeOverlayAction {
  id: string;
  icon: any;
  label: string;
}

/** Props passed to custom node overlay renderer */
export interface NodeOverlayProps {
  nodeId: string;
  nodeData: any;
  isRoot: boolean;
  isParent: boolean;
  isHovered: boolean;
  setIsHovered: (v: boolean) => void;
}

/** Props passed to custom node selection toolbar renderer */
export interface SelectedNodeToolbarProps {
  selectedNodeIds: string[];
  selectedNodeData: any[];
  onDeselect: () => void;
}

/** Props passed to custom edge selection toolbar renderer */
export interface SelectedEdgeToolbarProps {
  edgeId: string;
  edgeData: any;
  onDeselect: () => void;
}

/** Props passed to custom bottom bar renderer */
export interface BottomBarRenderProps {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  direction: FlowDirection;
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
  selectedNodeIds: string[];
  selectedNodeData: any[];
  selectedEdgeId: string | null;
  selectedEdgeData: any;
  onNodeDeselect: () => void;
  onEdgeDeselect: () => void;
  callbacks: FlowDiagramCallbacks;
}

/** Configuration for the flow diagram appearance and behavior */
export interface FlowDiagramConfig {
  /** Layout direction: "LR", "RL", "TB", "BT" */
  direction?: FlowDirection;
  /** Layout algorithm */
  layout?: LayoutAlgorithm;
  /** Theme accent color (Chakra token e.g. "blue.500") */
  themeColor?: string;
  /** Light or dark mode */
  colorMode?: "light" | "dark";
  /** Background pattern style */
  backgroundPattern?: BackgroundPattern;
  /** Background color override */
  backgroundColor?: string;
  /** Edge/line color override */
  edgeColor?: string;
  /** Min zoom level (default: 0.01) */
  minZoom?: number;
  /** Max zoom level (default: 1.5) */
  maxZoom?: number;
  /** Initial viewport position and zoom */
  initialViewport?: { pan: { x: number; y: number }; zoom: number };
  /** Enable edge drawing handles (default: true) */
  edgeHandles?: boolean;
  /** Disable all interactions */
  readOnly?: boolean;
  /** Enable inline node label editing */
  editable?: boolean;
  /** Actions rendered in the node hover overlay */
  nodeOverlayActions?: NodeOverlayAction[];
  /** Custom render function for node hover overlay */
  renderNodeOverlay?: (props: NodeOverlayProps) => React.ReactNode;
  /** Custom render function for multi-select toolbar */
  renderSelectedNodeToolbar?: (props: SelectedNodeToolbarProps) => React.ReactNode;
  /** Custom render function for edge selection toolbar */
  renderSelectedEdgeToolbar?: (props: SelectedEdgeToolbarProps) => React.ReactNode;
  /** Custom render function to replace the entire built-in bottom bar */
  renderBottomBar?: (props: BottomBarRenderProps) => React.ReactNode;
  /** Custom node view components to override SDK defaults. Keys: objectView, arrayView, text, parentContainer */
  customViews?: Record<string, React.ComponentType<any>>;
  /** Disable built-in keyboard shortcuts (Z/M/D) when the consumer handles its own */
  disableKeyboardShortcuts?: boolean;
  /** Externally controlled zoom mode (overrides internal state when provided) */
  isZoomMode?: boolean;
  /** Externally controlled multi-select mode (overrides internal state when provided) */
  isMultiSelectMode?: boolean;
  /** Externally controlled edge draw mode (overrides internal state when provided) */
  isEdgeHandlesEnabled?: boolean;
  /** Externally controlled drag/pan mode (overrides internal state when provided) */
  isDragMode?: boolean;
}

/** Event callbacks for the flow diagram */
export interface FlowDiagramCallbacks {
  // ── Node events ──
  /** Fires when a node is clicked/selected */
  onNodeSelect?: (nodeId: string, nodeData: any) => void;
  /** Fires when selection is cleared */
  onNodeDeselect?: () => void;
  /** Fires on double-click of a node */
  onNodeDoubleClick?: (nodeId: string, nodeData: any) => void;
  /** Fires when a node is created via edge drawing into empty space */
  onNodeCreate?: (params: { type: string; position: any; sourceNodeId?: string; isArrayMode?: boolean }) => void;
  /** Fires when a node is deleted */
  onNodeDelete?: (nodeId: string, nodeData: any) => void;
  /** Fires when a node label is edited inline */
  onNodeLabelChange?: (nodeId: string, newLabel: string) => void;
  /** Fires when a node's collapse toggle is clicked */
  onNodeCollapse?: (nodeId: string, collapsed: boolean) => void;
  /** Fires when a node's color is changed via the toolbar */
  onNodeColorChange?: (nodeId: string, colorType: "text" | "bg", color: string) => void;
  /** Fires when a node's icon is changed via the toolbar */
  onNodeIconChange?: (nodeId: string, iconName: string) => void;
  /** Fires when a hover overlay action is clicked */
  onNodeHoverAction?: (actionId: string, nodeId: string, nodeData: any) => void;

  // ── Edge events ──
  /** Fires when a new edge is drawn between two nodes */
  onEdgeCreate?: (sourceId: string, targetId: string) => void;
  /** Fires when an edge is clicked/selected */
  onEdgeSelect?: (edgeId: string, edgeData: any) => void;
  /** Fires when edge selection is cleared */
  onEdgeDeselect?: () => void;
  /** Fires when an edge is removed */
  onEdgeRemove?: (edgeId: string, edgeData: any) => void;
  /** Fires when an edge's color is changed */
  onEdgeColorChange?: (edgeId: string, color: string) => void;
  /** Fires when an edge's label is changed */
  onEdgeLabelChange?: (edgeId: string, newLabel: string) => void;
  /** Fires when an edge's style is changed (solid, dashed, animated) */
  onEdgeStyleChange?: (edgeId: string, style: "solid" | "dashed" | "animated") => void;

  // ── Diagram events ──
  /** Fires when the viewport (pan/zoom) changes */
  onViewportChange?: (viewport: { pan: { x: number; y: number }; zoom: number }) => void;
  /** Fires when the flow direction changes via bottom bar */
  onDirectionChange?: (direction: FlowDirection) => void;
  /** Fires when array/set mode toggles in bottom bar */
  onArrayModeChange?: (isArrayMode: boolean) => void;
  /** Fires when Cytoscape instance is initialized (for advanced use) */
  onCyInit?: (cy: any) => void;
}

/** Top-level props for the FlowDiagram component */
export interface FlowDiagramProps {
  /** Title shown on the root node */
  title?: string;
  /** Pre-computed nodes */
  nodes?: FlowDiagramNode[];
  /** Pre-computed edges */
  edges?: FlowDiagramEdge[];
  /** Diagram configuration */
  config?: FlowDiagramConfig;
  /** Event callbacks */
  callbacks?: FlowDiagramCallbacks;
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
}
