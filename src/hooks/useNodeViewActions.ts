import { useFlowDiagramContext } from "../components/FlowDiagramContext";

export function useNodeViewActions() {
  const {
    nodeViewModes,
    setNodeViewMode,
    allNodesIconLabel,
    setAllNodesIconLabel,
  } = useFlowDiagramContext();
  return {
    allNodesIconLabel,
    setAllNodesIconLabel,
    getNodeViewMode: (nodeId: string) => nodeViewModes[nodeId] ?? "default",
    showNodeProperties: (nodeId: string) =>
      setNodeViewMode(nodeId, "properties"),
    restoreNodeView: (nodeId: string) => setNodeViewMode(nodeId, "default"),
    toggleNodeView: (nodeId: string) =>
      setNodeViewMode(
        nodeId,
        nodeViewModes[nodeId] === "properties" ? "default" : "properties",
      ),
    setNodeViewMode,
  };
}
