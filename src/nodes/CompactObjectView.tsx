import { useState } from "react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useNodeViewActions } from "../hooks/useNodeViewActions";
import { useCloseOnDeselect } from "../hooks/useCloseOnDeselect";
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
  const { callbacks, readOnly } = useFlowDiagramContext();
  const parent = props.data?.config?.parentContainer;
  useCloseOnDeselect(
    props.data.id,
    properties && props.data?.config?.labelBelow && !parent,
    () => setProperties(false),
  );
  const toggleLabel = parent ? "Show parent" : "Show properties";
  const configurable =
    parent || props.data?.config?.form || props.data?.config?.ports?.length;
  const onExpand = configurable
    ? () => {
        if (parent) callbacks.onNodeCollapse?.(props.data.id, false);
        else setProperties(true);
      }
    : undefined;
  if (!parent && props.data.type === "text" && actions.getNodeViewMode(props.data.id) === "icon-label")
    return (
      <CompactNodeView
        {...props}
        renderCompact={undefined}
        data={{
          ...props.data,
          config: { ...props.data.config, labelBelow: true, icon: props.data.config?.icon || "PiTextT" },
        }}
        toggleLabel="Show text"
        onExpand={() => actions.restoreNodeView(props.data.id)}
      />
      );
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
        onExpand && (parent || props.data?.config?.labelBelow)
          ? () => {
              onExpand();
              callbacks.onNodeViewToggle?.(props.data.id);
            }
          : undefined
      }
      toggleLabel={toggleLabel}
      toggleDisabled={parent && readOnly}
      onExpand={onExpand}
    />
  );
};
