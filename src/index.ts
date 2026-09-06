// @squeed/flow-sdk - Standalone flow diagram renderer

// Main component
export { default as BottomBar } from "./components/BottomBar";
export {
  DiagramAppearanceControls,
  RangeInput as ToolbarRangeInput,
} from "./components/DiagramAppearanceControls";
export { ConnectionsOnlyToggle } from "./components/ConnectionsOnlyToggle";
export { CompactPropertyLayoutToggle } from "./components/CompactPropertyLayoutToggle";
export type { ConnectionsOnlyToggleProps } from "./components/ConnectionsOnlyToggle";
export { ErrorToast } from "./components/ErrorToast";
export { FlowDiagram } from "./components/FlowDiagram";
export {
  FlowDiagramProvider,
  useFlowData,
  useFlowDiagramContext,
} from "./components/FlowDiagramContext";
export type { FlowDiagramContextValue } from "./components/FlowDiagramContext";
export { FlowPort } from "./components/FlowPort";
export { useNodeViewActions } from "./hooks/useNodeViewActions";
export type { FlowPortProps } from "./components/FlowPort";
export { default as FlowView } from "./components/FlowView";
export { NodeFormPopover } from "./components/NodeFormPopover";
export { NODE_TYPE_VIEWS } from "./types";
export type { NodeTypeView } from "./types";
export { NodeIconPicker } from "./components/NodeIconPicker";
export {
  DEFAULT_PALETTE,
  EdgeTools,
  BorderRadiusControl as NodeBorderRadiusControl,
  NodeTools,
  Swatches,
  TEXT_PALETTE,
  CloseButton as ToolbarCloseButton,
  CommitInput as ToolbarCommitInput,
} from "./components/SelectionToolbar";
export { SvgExportButton } from "./components/SvgExportButton";
export {
  ToolbarDivider,
  ToolbarIconButton,
  ToolbarSelect,
  ToolbarTooltip,
} from "./components/toolbarControls";
export { ToolbarScrollContainer } from "./components/ToolbarScrollContainer";
export { default as TooltipIconButton } from "./components/TooltipIconButton";
export { WorkflowControls } from "./components/WorkflowControls";
export { createFormNode } from "./core/createFormNode";
export { createJsonStream, createJsonPlayback } from "./core/jsonStream";
export { projectJsonPlaybackPreview } from "./core/jsonPlaybackPreview";
export type { JsonStreamOptions, JsonPlaybackState } from "./core/jsonStream";
export { applyFormChange, formValueError, readFormSchema } from "./core/forms";
export {
  createFlowDocumentActions,
  parseFlowDocument,
} from "./core/documentActions";
export type { FlowDocumentActionOptions } from "./core/documentActions";
export type {
  FormBinding,
  FormChange,
  FormCondition,
  FormCreation,
  FormEdit,
  FormFieldConfig,
  FormOption,
  FormOptionsRequest,
  FormRequest,
  FormSchema,
  FormValue,
} from "./core/forms";
export { parseTypeScriptForm } from "./core/workflowContract";
export { NodeConfigSummary } from "./nodes/NodeConfigSummary";
export { FormDocumentContext, NodeForm } from "./nodes/NodeForm";
export { downloadSvg, exportSvg } from "./utils/exportSvg";
export { resolveStateView, applyStateEdits } from "./utils/formState";
export type { StateFormBinding, StateForms } from "./utils/formState";

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
  FlowNodeCreationRequest,
  FlowDiagramConfig,
  FlowDiagramEdge,
  FlowDiagramNode,
  FlowDiagramProps,
  FlowDirection,
  FlowEdgeProperties,
  FlowEngine,
  LayoutAlgorithm,
  NodeAlignment,
  NodeAnimationVariant,
  EdgeAnimationVariant,
  NodeOverlayAction,
  NodeOverlayProps,
  NodeSelectionModifiers,
  NodeSpacing,
  ParentNodeStyle,
  SelectedEdgeToolbarProps,
  SelectedNodeToolbarProps,
  SelectionToolbarConfig,
  SqueedChangeInfo,
  SqueedConnection,
  SqueedConnectionRef,
} from "./types";
