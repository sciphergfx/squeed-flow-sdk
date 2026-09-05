import type { FlowEngine } from "../engine/types";
import type { BuiltInEdgeType, CustomEdgeFactory } from "./edgeTypes";
export type {
  BuiltInEdgeType,
  CustomEdgeContext,
  CustomEdgeFactory,
  CustomEdgeGeometry,
} from "./edgeTypes";

export type { FlowEngine } from "../engine/types";

export enum FlowType {
  TOP_DOWN = "TB",
  BOTTOM_UP = "BT",
  LEFT_RIGHT = "LR",
  RIGHT_LEFT = "RL",
  CENTER = "C",
}

/** "C" = center: root in the middle, children fan out both ways (generate with `isCntr: true`); laid out as LR */
export type FlowDirection = "LR" | "RL" | "TB" | "BT" | "C";
export type NodeAlignment = "leading" | "center" | "trailing";
export type EdgeMode = "nodes" | "properties" | "workflow";
export interface FlowEdgeProperties {
  sourceProperty?: string;
  targetProperty?: string;
}

export interface SqueedConnection extends FlowEdgeProperties {
  icon?: string;
  target: string;
  type?: string;
  id?: string;
  label?: string;
  color?: string;
  style?: "solid" | "dashed" | "animated";
}

export interface SqueedConnectionRef {
  address: string;
  key: string;
}

export type LayoutAlgorithm =
  | "dagre"
  | "elk"
  | "tidytree"
  | "concentric"
  | "cose";
export type BackgroundPattern = "dot" | "steel" | "grid" | "none";
export type BackgroundVariant = BackgroundPattern | "transparent";
export type NodeSpacing = number | "compact" | "normal" | "spacious";

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
    isNodeAnimated?: boolean;
  };
}

export interface FlowDiagramEdge {
  data: {
    id: string;
    type?: BuiltInEdgeType | (string & {});
    source: string;
    target: string;
    sourceProperty?: string;
    targetProperty?: string;
    connection?: SqueedConnectionRef;
    label?: string;
    icon?: string;
    /** Chakra token or hex; overrides the theme/edgeColor line color for this edge */
    color?: string;
    isInverted?: boolean;
    isEdgeAnimated?: boolean;
    isEdgeDashed?: boolean;
  };
}

/** Built-in selection toolbars (shown in the bottom bar when a node/edge is selected) */
export interface SelectionToolbarConfig {
  /** Swatches offered for node/edge colors (Chakra tokens or hex). Default: 9 Chakra 500s */
  palette?: string[];
  /** Hide individual controls */
  hide?: Array<
    | "label"
    | "color"
    | "textColor"
    | "borderColor"
    | "style"
    | "outline"
    | "animation"
    | "icon"
    | "collapse"
    | "delete"
  >;
}

/**
 * Style for compound (container) nodes. Set per node via `data.viewProps`,
 * or for all containers via `config.parentNodeStyle` (per-node wins).
 * Colors accept Chakra tokens ("purple.500") or hex.
 */
export interface ParentNodeStyle {
  outline?: boolean;
  /** Fill color; also the default border/label color (default: themeColor) */
  bgColor?: string;
  /** Fill opacity 0–1 (default 0.4) */
  bgOpacity?: number;
  borderColor?: string;
  /** px (default 6) */
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted" | "double";
  /** Corner radius px (default 50) */
  borderRadius?: number;
  /** Label color (default: bgColor) */
  textColor?: string;
  /** Label size px (default 70) */
  fontSize?: number;
  /** Inner padding px (default 120) */
  padding?: number;
  /** Label placement (default "top") */
  labelPosition?: "top" | "center" | "bottom";
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
  formSchema?: import("../core/forms").FormSchema;
  spacing?: NodeSpacing;
  edgeRadius?: number;
  backgroundVariant?: BackgroundVariant;
  edgeType?: BuiltInEdgeType | (string & {});
  customEdgeTypes?: Record<string, CustomEdgeFactory>;
  /** Layout direction: "LR", "RL", "TB", "BT" */
  direction?: FlowDirection;
  nodeAlignment?: NodeAlignment;
  edgeMode?: EdgeMode;
  workflowContract?: import("../core/workflowContract").WorkflowContract;
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
  /** Default style for all compound/container nodes (per-node `viewProps` override it) */
  parentNodeStyle?: ParentNodeStyle;
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
  renderSelectedNodeToolbar?: (
    props: SelectedNodeToolbarProps,
  ) => React.ReactNode;
  /** Custom render function for edge selection toolbar */
  renderSelectedEdgeToolbar?: (
    props: SelectedEdgeToolbarProps,
  ) => React.ReactNode;
  /** Custom render function to replace the entire built-in bottom bar */
  renderBottomBar?: (props: BottomBarRenderProps) => React.ReactNode;
  /** Built-in node/edge selection toolbars (bottom bar swaps to them on select). `false` disables. */
  selectionToolbar?: SelectionToolbarConfig | false;
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
  onFormSchemaChange?: (schema: import("../core/forms").FormSchema) => void;
  onFormChange?: (
    event: import("../core/forms").FormChange,
  ) => import("../core/forms").FormEdit[] | void;
  resolveFormOptions?: (
    request: import("../core/forms").FormOptionsRequest,
  ) =>
    | Promise<import("../core/forms").FormOption[]>
    | import("../core/forms").FormOption[];
  onSpacingChange?: (spacing: NodeSpacing) => void;
  onEdgeRadiusChange?: (radius: number) => void;
  onBackgroundVariantChange?: (variant: BackgroundVariant) => void;
  // ── Node events ──
  /** Fires when a node is clicked/selected */
  onNodeSelect?: (nodeId: string, nodeData: any) => void;
  /** Fires when selection is cleared */
  onNodeDeselect?: () => void;
  /** Fires on double-click of a node */
  onNodeDoubleClick?: (nodeId: string, nodeData: any) => void;
  /** Fires when a node is created via edge drawing into empty space */
  onNodeCreate?: (params: {
    type: string;
    position: any;
    sourceNodeId?: string;
    isArrayMode?: boolean;
  }) => void;
  /** Fires when a node is deleted */
  onNodeDelete?: (nodeId: string, nodeData: any) => void;
  /** Fires when a node label is edited inline */
  onNodeLabelChange?: (nodeId: string, newLabel: string) => void;
  onNodeContentChange?: (nodeId: string, content: string) => void;
  /** Fires when a node's collapse toggle is clicked */
  onNodeCollapse?: (nodeId: string, collapsed: boolean) => void;
  /** Fires when a node's color is changed via the toolbar */
  onNodeColorChange?: (
    nodeId: string,
    colorType: "text" | "bg",
    color: string,
  ) => void;
  /** Fires when a node's icon is changed via the toolbar */
  onNodeIconChange?: (nodeId: string, iconName: string) => void;
  onNodeOutlineChange?: (nodeId: string, outline: boolean) => void;
  onNodeBorderColorChange?: (nodeId: string, color: string) => void;
  onNodeBorderStyleChange?: (nodeId: string, style: "solid" | "dashed") => void;
  onNodeBorderWidthChange?: (nodeId: string, width: number | undefined) => void;
  onNodeBorderRadiusChange?: (
    nodeId: string,
    radius: number | undefined,
  ) => void;
  onNodeAnimationChange?: (nodeId: string, animated: boolean) => void;
  /** Fires when a hover overlay action is clicked */
  onNodeHoverAction?: (actionId: string, nodeId: string, nodeData: any) => void;

  // ── Edge events ──
  /** Fires when a new edge is drawn between two nodes */
  onEdgeCreate?: (
    sourceId: string,
    targetId: string,
    properties?: FlowEdgeProperties,
  ) => void;
  /** Fires when an edge is clicked/selected */
  onEdgeSelect?: (edgeId: string, edgeData: any) => void;
  /** Fires when edge selection is cleared */
  onEdgeDeselect?: () => void;
  /** Fires when an edge is removed */
  onEdgeRemove?: (edgeId: string, edgeData: any) => void;
  /** Fires when the user deletes an edge from the selection toolbar */
  onEdgeDelete?: (edgeId: string, edgeData: any) => void;
  /** Fires when an edge's color is changed */
  onEdgeColorChange?: (edgeId: string, color: string) => void;
  onEdgeTypeChange?: (edgeId: string, type: string | undefined) => void;
  onEdgeIconChange?: (edgeId: string, icon: string) => void;
  /** Fires when an edge's label is changed */
  onEdgeLabelChange?: (edgeId: string, newLabel: string) => void;
  /** Fires when an edge's style is changed (solid, dashed, animated) */
  onEdgeStyleChange?: (
    edgeId: string,
    style: "solid" | "dashed" | "animated",
  ) => void;

  // ── Diagram events ──
  /** Fires when the viewport (pan/zoom) changes */
  onViewportChange?: (viewport: {
    pan: { x: number; y: number };
    zoom: number;
  }) => void;
  /** Fires when the flow direction changes via bottom bar */
  onDirectionChange?: (direction: FlowDirection) => void;
  onThemeColorChange?: (color: string) => void;
  onEdgeModeChange?: (mode: EdgeMode) => void;
  onWorkflowContractChange?: (
    contract: import("../core/workflowContract").WorkflowContract | undefined,
  ) => void;
  /** Fires when array/set mode toggles in bottom bar */
  onArrayModeChange?: (isArrayMode: boolean) => void;
  /** Fires once the renderer is ready with the engine handle (zoom/pan/fit/coordinate helpers) */
  onInit?: (engine: FlowEngine) => void;

  // ── Squeed document mode (when `json` prop is used) ──
  /**
   * Fires with the updated Squeed JSON after any toolbar/inline edit. The SDK applies the
   * edit with `$` schema keys; store the result and pass it back as `json`.
   */
  onJsonChange?: (
    json: Record<string, any> | any[],
    change: SqueedChangeInfo,
  ) => void;
}

/** Describes the edit behind an `onJsonChange` */
export interface SqueedChangeInfo {
  type:
    | "nodeLabel"
    | "nodeContent"
    | "nodeColor"
    | "nodeStyle"
    | "nodeIcon"
    | "nodeOutline"
    | "nodeAnimation"
    | "nodeCollapse"
    | "nodeCreate"
    | "nodeDelete"
    | "edgeLabel"
    | "edgeStyle"
    | "edgeColor"
    | "edgeCreate"
    | "edgeDelete";
  address?: string;
  edge?: FlowEdgeProperties & {
    source: string;
    target: string;
    isInverted?: boolean | null;
    connection?: SqueedConnectionRef;
  };
  key?: string;
  value?: unknown;
}

/** Top-level props for the FlowDiagram component */
export interface FlowDiagramProps {
  /** Title shown on the root node */
  title?: string;
  /**
   * Squeed JSON document. When provided, nodes/edges are compiled from it and every
   * edit is reported through `callbacks.onJsonChange`. Takes precedence over nodes/edges.
   */
  json?: Record<string, any> | any[];
  /** Pre-computed nodes */
  nodes?: FlowDiagramNode[];
  /** Pre-computed edges */
  edges?: FlowDiagramEdge[];
  /** Diagram configuration */
  config?: FlowDiagramConfig;
  /** Event callbacks */
  callbacks?: FlowDiagramCallbacks;
  showBottomBar?: boolean;
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
}
