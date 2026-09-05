import { PiPencilSimpleLine } from "react-icons/pi";
import {
  DiagramAppearanceControls, NodeTools, EdgeTools, ToolbarIconButton,
  ToolbarTooltip, ToolbarDivider, useFlowDiagramContext, useFlowData,
} from "@squeed/flow-sdk";

export function ConsumerControls() {
  const controls = useFlowDiagramContext();
  const { nodeById } = useFlowData();
  return <div role="toolbar" aria-label="Consumer controls" style={{ position: "absolute", top: 8, left: 8, right: 8, zIndex: 300, background: "#f4f4f5", color: "#18181b", display: "flex", gap: 8, overflowX: "auto", padding: 8 }}>
    <ToolbarTooltip label="Draw connections">
      <ToolbarIconButton aria-label="Consumer draw" aria-pressed={controls.isEdgeHandlesEnabled}
        icon={<PiPencilSimpleLine />} onClick={() => controls.setIsEdgeHandlesEnabled(!controls.isEdgeHandlesEnabled)} />
    </ToolbarTooltip>
    <ToolbarDivider />
    <span data-testid="consumer-node-count">{nodeById.size}</span>
    <DiagramAppearanceControls />
    {controls.selectedNodeIds.length > 0 && <NodeTools ids={controls.selectedNodeIds} onClose={() => controls.setSelectedNodeIds([])} />}
    {controls.selectedEdgeId && <EdgeTools edgeId={controls.selectedEdgeId} onClose={() => controls.setSelectedEdgeId(null)} />}
  </div>;
}