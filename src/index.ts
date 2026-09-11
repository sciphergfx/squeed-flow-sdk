// @squeed/flow-sdk - Standalone flow diagram renderer

export { createWorkflowExecution } from "./utils/workflowExecution";
export type {
  WorkflowExecutionAdapter,
  WorkflowExecutionRequest,
  WorkflowExecutionState,
  WorkflowExecutionUpdate,
  WorkflowRunStatus,
  WorkflowStepStatus,
} from "./utils/workflowExecution";

// Main component
export { default as BottomBar } from "./components/BottomBar";
export { CompactPropertyLayoutToggle } from "./components/CompactPropertyLayoutToggle";
export { ConnectionsOnlyToggle } from "./components/ConnectionsOnlyToggle";
export type { ConnectionsOnlyToggleProps } from "./components/ConnectionsOnlyToggle";
export {
  DiagramAppearanceControls,
  RangeInput as ToolbarRangeInput,
} from "./components/DiagramAppearanceControls";
export { ErrorToast } from "./components/ErrorToast";
export { FlowDiagram } from "./components/FlowDiagram";
export {
  FlowDiagramProvider,
  useFlowData,
  useFlowDiagramContext,
} from "./components/FlowDiagramContext";
export type { FlowDiagramContextValue } from "./components/FlowDiagramContext";
export { FlowPort } from "./components/FlowPort";
export type { FlowPortProps } from "./components/FlowPort";
export { default as FlowView } from "./components/FlowView";
export { CollapseAllToggle } from "./components/LabeledToolbarToggle";
export { LoadingBorder } from "./components/LoadingBorder";
export { NodeFormPopover } from "./components/NodeFormPopover";
export { GridAdjustmentToggle } from "./components/NodeGridControls";
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
export {
  createFlowDocumentActions,
  parseFlowDocument,
} from "./core/documentActions";
export type { FlowDocumentActionOptions } from "./core/documentActions";
export { applyFormChange, formValueError, readFormSchema } from "./core/forms";
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
  FormUploadRequest,
  FormValue,
} from "./core/forms";
export { projectJsonPlaybackPreview } from "./core/jsonPlaybackPreview";
export { createJsonPlayback, createJsonStream } from "./core/jsonStream";
export type { JsonPlaybackState, JsonStreamOptions } from "./core/jsonStream";
export { parseTypeScriptForm } from "./core/workflowContract";
export { useNodeViewActions } from "./hooks/useNodeViewActions";
export { NodeConfigSummary } from "./nodes/NodeConfigSummary";
export { FormDocumentContext, NodeForm } from "./nodes/NodeForm";
export { LIGHT_BLACK } from "./theme/colorUtils";
export { NODE_TYPE_VIEWS } from "./types";
export type { ContentFormat, NodeTypeView } from "./types";
export { downloadSvg, exportSvg } from "./utils/exportSvg";
export { applyStateEdits, resolveStateView } from "./utils/formState";
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
export { getInteractionSurface } from "./theme/interactionShadow";
export {
  useCustomColors,
  useThemeContentColors,
} from "./theme/useCustomColors";

// Hooks (for consumers building custom editable node content)
export {
  copySelection,
  duplicateSelection,
  getSelectionRoots,
  reparentNode,
} from "./core/selectionEdits";
export { useEdgeProximity } from "./hooks/useEdgeProximity";
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
export { validateGridAdjustment } from "./engine/nodeCollisions";
export type {
  NodeCollision,
  NodeCollisionOptions,
  NodeCollisionResolution,
  NodeGridArrangement,
  NodeGridOptions,
  ResolveNodeCollisionsOptions,
} from "./engine/nodeCollisions";
export type {
  BackgroundPattern,
  BackgroundVariant,
  BottomBarRenderProps,
  BuiltInEdgeType,
  CustomEdgeContext,
  CustomEdgeFactory,
  CustomEdgeGeometry,
  EdgeAnimationVariant,
  EdgeMode,
  FlowDiagramCallbacks,
  FlowDiagramConfig,
  FlowDiagramEdge,
  FlowDiagramNode,
  FlowDiagramProps,
  FlowDirection,
  FlowEdgeProperties,
  FlowEngine,
  FlowNodeCreationRequest,
  JsxContentRendererProps,
  LayoutAlgorithm,
  NodeAlignment,
  NodeAnimationVariant,
  NodeContent,
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
