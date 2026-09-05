// @squeed/flow-sdk - Standalone flow diagram renderer

// Main component
export { FlowDiagram } from "./components/FlowDiagram";
export { default as BottomBar } from "./components/BottomBar";
export { default as FlowView } from "./components/FlowView";
export { FlowDiagramProvider, useFlowDiagramContext, useFlowData } from "./components/FlowDiagramContext";
export type { FlowDiagramContextValue } from "./components/FlowDiagramContext";
export { ToolbarIconButton, ToolbarTooltip, ToolbarDivider, ToolbarSelect } from "./components/toolbarControls";
export { ToolbarScrollContainer } from "./components/ToolbarScrollContainer";
export { default as TooltipIconButton } from "./components/TooltipIconButton";
export { NodeTools, EdgeTools, Swatches, DEFAULT_PALETTE, TEXT_PALETTE,
  CommitInput as ToolbarCommitInput, CloseButton as ToolbarCloseButton,
  BorderRadiusControl as NodeBorderRadiusControl } from "./components/SelectionToolbar";
export { DiagramAppearanceControls } from "./components/DiagramAppearanceControls";
export { WorkflowControls } from "./components/WorkflowControls";
export { SvgExportButton } from "./components/SvgExportButton";
export { NodeIconPicker } from "./components/NodeIconPicker";
export { NodeFormPopover } from "./components/NodeFormPopover";
export { NodeForm, FormDocumentContext } from "./nodes/NodeForm";
export { NodeConfigSummary } from "./nodes/NodeConfigSummary";
export { ErrorToast } from "./components/ErrorToast";
export { FlowPort } from "./components/FlowPort";
export type { FlowPortProps } from "./components/FlowPort";
export { createFormNode } from "./core/createFormNode";
export type { FormCreation } from "./core/forms";
export { applyFormChange, formValueError, readFormSchema } from "./core/forms";
export type {
  FormBinding,
  FormChange,
  FormCondition,
  FormEdit,
  FormFieldConfig,
  FormOption,
  FormOptionsRequest,
  FormRequest,
  FormSchema,
  FormValue,
} from "./core/forms";
export { parseTypeScriptForm } from "./core/workflowContract";
export { downloadSvg, exportSvg } from "./utils/exportSvg";
export type { StateForms, StateFormBinding } from "./utils/formState";
export { resolveStateView } from "./utils/formState";

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
export { EditableLabel } from "./nodes/EditableLabel";
export { default as NodeView } from "./nodes/NodeView";

// Utilities
export {
  connectionIssue,
  parseJsonContract,
  parseTypeScriptContract,
  readWorkflowContract,
} from "./core/workflowContract";
export type {
  ContractProperty,
  ContractType,
  WorkflowContract,
} from "./core/workflowContract";
export { default as DynamicIcon } from "./utils/DynamicIcon";

// Types
export type {
  BackgroundPattern,
  BackgroundVariant,
  BottomBarRenderProps,
  BuiltInEdgeType,
  CustomEdgeContext,
  CustomEdgeFactory,
  CustomEdgeGeometry,
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
  NodeSpacing,
  ParentNodeStyle,
  SelectedEdgeToolbarProps,
  SelectedNodeToolbarProps,
  SelectionToolbarConfig,
  SqueedChangeInfo,
  SqueedConnection,
  SqueedConnectionRef,
} from "./types";
