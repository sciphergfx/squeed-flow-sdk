// @squeed/flow-sdk - Standalone flow diagram renderer

// Main component
export { FlowDiagram } from "./components/FlowDiagram";

// Core diagram generation
export { createFlowDiagram } from "./core/createFlowDiagram";

// Squeed JSON editing: translate toolbar callbacks into `$` schema keys, then recompile
export { bindSqueedCallbacks } from "./core/squeedBinding";
export type { SqueedChange } from "./core/squeedBinding";
export {
  addChild,
  addConnection,
  addressToPath,
  addTargetEdge,
  applyCollapsed,
  compileSqueed,
  getNode,
  removeEdge,
  removeNode,
  resolveEdgeOwner,
  setCollapsed,
  setEdgeProp,
  setEdgeStyle,
  setNodeProp,
  updateNode,
} from "./core/squeedEdits";
export type {
  CompileOptions,
  RenderedEdgeRef,
  SqueedEdgeKey,
  SqueedJson,
  SqueedNodeKey,
} from "./core/squeedEdits";

// Theme utilities (for consumers building custom overlays)
export {
  contentObjTheme,
  getChakraColorHex,
  getColorVariant,
  getDarkerHexColor,
} from "./theme/colorUtils";
export {
  useCustomColors,
  useThemeContentColors,
} from "./theme/useCustomColors";

// Hooks (for consumers building custom editable node content)
export { useStopPropagation } from "./hooks/useStopPropagation";
export { default as NodeView } from "./nodes/NodeView";
export { EditableLabel } from "./nodes/EditableLabel";

// Utilities
export { default as DynamicIcon } from "./utils/DynamicIcon";

// Types
export type {
  BackgroundPattern,
  BuiltInEdgeType,
  CustomEdgeContext,
  CustomEdgeFactory,
  CustomEdgeGeometry,
  BottomBarRenderProps,
  EdgeMode,
  FlowDiagramCallbacks,
  FlowDiagramConfig,
  FlowDiagramEdge,
  FlowDiagramNode,
  FlowDiagramProps,
  FlowDirection,
  FlowEdgeProperties,
  FlowEngine,
  LayoutAlgorithm,
  NodeAlignment,
  NodeOverlayAction,
  NodeOverlayProps,
  ParentNodeStyle,
  SelectedEdgeToolbarProps,
  SelectedNodeToolbarProps,
  SelectionToolbarConfig,
  SqueedChangeInfo,
  SqueedConnection,
  SqueedConnectionRef,
} from "./types";
