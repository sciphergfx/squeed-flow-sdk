import { useContext } from "react";
import { useFlowData } from "../components/FlowDiagramContext";
import { FormDocumentContext } from "../nodes/NodeForm";
import { getNode } from "../core/squeedEdits";

export function useNodeHasChildren(id: string) {
  const { viewData: data } = useContext(FormDocumentContext);
  const { nodeById, edgeById, parentIds } = useFlowData();
  if (data) {
    const node = getNode(data, id);
    const children = node && typeof node === "object" && !Array.isArray(node) && "$" in node ? node.$ : node;
    if (Array.isArray(children)) return children.length > 0;
    return !!children && typeof children === "object" && Object.entries(children).some(
      ([key, value]) => !key.startsWith("$") && value !== null && typeof value === "object",
    );
  }
  if (parentIds.has(id)) return true;
  return [...edgeById.values()].some(({ data: edge }) => {
    const source = edge.isInverted ? edge.target : edge.source;
    const target = edge.isInverted ? edge.source : edge.target;
    return source === id && target !== id && nodeById.has(target);
  });
}