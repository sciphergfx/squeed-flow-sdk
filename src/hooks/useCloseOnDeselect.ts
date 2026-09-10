import { useEffect, useRef } from "react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";

export function useCloseOnDeselect(
  nodeId: string,
  expanded: boolean,
  onClose: () => void,
) {
  const { readOnly, selectedNodeIds } = useFlowDiagramContext();
  const selected = selectedNodeIds.includes(nodeId);
  const wasSelected = useRef(selected);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (wasSelected.current && !selected && expanded && !readOnly)
      close.current();
    wasSelected.current = selected;
  }, [selected, expanded, readOnly]);
}
