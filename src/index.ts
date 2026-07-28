// @squeed/flow-sdk - Standalone flow diagram renderer

// Main component
export { FlowDiagram } from "./components/FlowDiagram";

// Core diagram generation
export { createFlowDiagram } from "./core/createFlowDiagram";

// Theme utilities (for consumers building custom overlays)
export { useCustomColors, useThemeContentColors } from "./theme/useCustomColors";
export { getChakraColorHex, getColorVariant, contentObjTheme, getDarkerHexColor } from "./theme/colorUtils";

// Hooks (for consumers building custom editable node content)
export { useStopPropagation } from "./hooks/useStopPropagation";

// Utilities
export { default as DynamicIcon } from "./utils/DynamicIcon";

// Types
export type {
  FlowDiagramProps,
  FlowDiagramConfig,
  FlowDiagramCallbacks,
  FlowDiagramNode,
  FlowDiagramEdge,
  FlowDirection,
  LayoutAlgorithm,
  BackgroundPattern,
  NodeOverlayAction,
  NodeOverlayProps,
  SelectedNodeToolbarProps,
  SelectedEdgeToolbarProps,
  BottomBarRenderProps,
} from "./types";
