import { useEffect, useRef, useState } from "react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useNodeViewActions } from "../hooks/useNodeViewActions";
import { CompactNodeView } from "./CompactNodeView";
import { ObjectNodeView } from "./ObjectNodeView";

export const CompactObjectView = (props) => {
  const actions = useNodeViewActions();
  const [editOnOpen, setEditOnOpen] = useState(false);
  const properties = actions.getNodeViewMode(props.data.id) === "properties";
  const setProperties = (value: boolean) => {
    setEditOnOpen(value);
    actions.setNodeViewMode(props.data.id, value ? "properties" : "default");
  };
  const { callbacks, readOnly, selectedNodeIds } = useFlowDiagramContext();
  const parent = props.data?.config?.parentContainer;
  const selected = selectedNodeIds.includes(props.data.id);
  const wasSelected = useRef(selected);
  useEffect(() => {
    if (wasSelected.current && !selected && properties && props.data?.config?.labelBelow && !parent && !readOnly)
      setProperties(false);
    wasSelected.current = selected;
  }, [selected, properties, props.data?.config?.labelBelow, parent, readOnly]);
  const toggleLabel = parent ? "Show parent" : "Show properties";
  const configurable =
    parent || props.data?.config?.form || props.data?.config?.ports?.length;
  if (!parent && configurable && properties)
    return (
      <ObjectNodeView
        {...props}
        editOnMount={editOnOpen}
        onShowIcon={() => setProperties(false)}
      />
    );
  return (
    <CompactNodeView
      {...props}
      onOpenView={
        !parent && configurable && props.data?.config?.labelBelow
          ? () => {
              setProperties(true);
              callbacks.onNodeViewToggle?.(props.data.id);
            }
          : undefined
      }
      toggleLabel={toggleLabel}
      toggleDisabled={parent && readOnly}
      onExpand={
        configurable
          ? () => {
              if (parent) callbacks.onNodeCollapse?.(props.data.id, false);
              else setProperties(true);
            }
          : undefined
      }
    />
  );
};
