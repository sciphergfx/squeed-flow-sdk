import { Box } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { NodeFormPopover } from "../components/NodeFormPopover";
import { useCustomColors } from "../theme/useCustomColors";
import { getChakraColorHex } from "../theme/colorUtils";
import { getNodeBorderProps } from "./nodeBorder";
import NodeView from "./NodeView";
import { useNodeViewActions } from "../hooks/useNodeViewActions";
import { useCloseOnDeselect } from "../hooks/useCloseOnDeselect";
import { CompactNodeView } from "./CompactNodeView";
import { FormDocumentContext, NodeForm } from "./NodeForm";

export function GridNodeView(props) {
  const { config, callbacks, readOnly, selectedNodeIds, nodeRadiusPreviews } = useFlowDiagramContext();
  const radius = nodeRadiusPreviews[props.data.id] ?? props.data.viewProps?.borderRadius;
  const [formOpen, setFormOpen] = useState(false);
  const actions = useNodeViewActions();
  const { border, colorText } = useCustomColors();
  const Content = config.customViews?.gridContent;
  const compact = actions.getNodeViewMode(props.data.id) === "icon-label";
  const openedFromIcon = useRef(compact);
  if (compact) openedFromIcon.current = true;
  useCloseOnDeselect(props.data.id, !compact && openedFromIcon.current, () =>
    actions.setNodeViewMode(props.data.id, "icon-label"),
  );
  if (compact)
    return (
      <Box data-grid-document={props.data.config?.documentId ?? ""}>
        <CompactNodeView
          {...props}
          data={{
            ...props.data,
            viewProps: { ...props.data.viewProps, borderRadius: radius },
            config: {
              ...props.data.config,
              labelBelow: true,
              icon: props.data.config?.icon || "PiGridFour",
            },
          }}
          toggleLabel="Show grid"
          onExpand={() => actions.restoreNodeView(props.data.id)}
        />
      </Box>
    );
  return (
    <>
    <NodeView {...props} onOpenView={() => setFormOpen(true)}>
      {({ data, isActive }) => (
        <Box
          data-flow-node-surface=""
          data-grid-document={data.config?.documentId ?? ""}
          width={`${data.config?.gridSize?.width ?? 600}px`}
          height={`${data.config?.gridSize?.height ?? 440}px`}
          overflow="hidden"
          position="relative"
          bg={data.viewProps?.bgColor ?? "transparent"}
          color={data.viewProps?.textColor ?? colorText}
          borderRadius={`${radius ?? 0}px`}
          {...getNodeBorderProps(
            data.viewProps,
            getChakraColorHex(data.viewProps?.borderColor ?? border),
            isActive,
            0,
          )}
        >
          {Content ? (
            <Content {...props} />
          ) : (
            <Box p={4}>{data.label ?? "Grid"}</Box>
          )}
        </Box>
      )}
    </NodeView>
    <NodeFormPopover
      nodeAddress={props.data.id}
      active={selectedNodeIds.includes(props.data.id)}
      label={props.data.label ?? "Grid"}
      open={formOpen && !readOnly}
      onClose={() => setFormOpen(false)}
    >
      <FormDocumentContext.Provider value={{
        data: { metadata: { label: props.data.label ?? "", subtitle: props.data.config?.subtitle ?? "", icon: props.data.config?.icon ?? "PiGridFour" } },
        bindings: { [props.data.id]: { address: "root.metadata", type: "GridMetadata" } },
        schema: { GridMetadata: { kind: "object", properties: {
          label: { optional: true, type: { kind: "string" } },
          subtitle: { optional: true, type: { kind: "string" } },
          icon: { optional: true, type: { kind: "string" } },
        } } },
        editable: !!config.editable && !readOnly,
        callbacks: {
          onFormChange: (change) => {
            if (readOnly || !config.editable) return;
            const value = String(change.value ?? "");
            if (change.address === "root.metadata.label") callbacks.onNodeLabelChange?.(props.data.id, value);
            else if (change.address === "root.metadata.subtitle") callbacks.onNodeSubtitleChange?.(props.data.id, value);
            else if (change.address === "root.metadata.icon") callbacks.onNodeIconChange?.(props.data.id, value);
          },
        },
      }}>
        <NodeForm nodeAddress={props.data.id} />
      </FormDocumentContext.Provider>
    </NodeFormPopover>
    </>
  );
}
