import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useNodeViewActions } from "../hooks/useNodeViewActions";
import { CompactNodeView } from "./CompactNodeView";
import { ObjectNodeView } from "./ObjectNodeView";

export const CompactObjectView = (props) => {
  const actions = useNodeViewActions();
  const properties = actions.getNodeViewMode(props.data.id) === "properties";
  const setProperties = (value: boolean) =>
    actions.setNodeViewMode(props.data.id, value ? "properties" : "default");
  const { callbacks, readOnly } = useFlowDiagramContext();
  const parent = props.data?.config?.parentContainer;
  const toggleLabel = parent ? "Show parent" : "Show properties";
  const configurable =
    parent || props.data?.config?.form || props.data?.config?.ports?.length;
  if (!parent && configurable && properties)
    return (
      <ObjectNodeView {...props} onShowIcon={() => setProperties(false)} />
    );
  return (
    <CompactNodeView
      {...props}
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
