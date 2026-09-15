import { Box } from "@chakra-ui/react";
import type { ComponentProps } from "react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import type { ContainerStyle } from "../engine/ContainerView";
import { EDGE_LABEL_FONT_FAMILY } from "../engine/text";
import { EditableLabel } from "./EditableLabel";
import NodeView from "./NodeView";
import { NodeText } from "./nodeText";
import { CompactObjectView } from "./CompactObjectView";
import { ObjectNodeView } from "./ObjectNodeView";
import { GridNodeView } from "./GridNodeView";
import { PromptNodeView } from "./PromptNodeView";

const text = (props) => (
  <CompactObjectView {...props} renderCompact={NodeText} />
);
const arrayView = (props) => <CompactObjectView {...props} />;
const ParentContainerView = ({
  containerStyle,
  ...props
}: Omit<ComponentProps<typeof NodeView>, "children"> & {
  containerStyle: ContainerStyle;
}) => {
  const { selectedNodeIds } = useFlowDiagramContext();
  return (
    <NodeView {...props} editOnMount={selectedNodeIds.includes(props.data.id)}>
      {(args) => (
        <Box
          bg={
            containerStyle.textColor === "transparent"
              ? "transparent"
              : containerStyle.labelBg
          }
          p={`${containerStyle.fontSize / 5}px`}
          fontFamily={EDGE_LABEL_FONT_FAMILY}
          lineHeight={1}
          w="fit-content"
        >
          <EditableLabel
            nodeId={args.id}
            label={args.data.label ?? args.data.headerTitle ?? "Container"}
            color={containerStyle.textColor}
            fontSize={`${containerStyle.fontSize}px`}
            isEditing={args.isEditing}
            onEditStart={args.onEditStart}
            onEditEnd={args.onEditEnd}
          />
        </Box>
      )}
    </NodeView>
  );
};

text.displayName = "text";
arrayView.displayName = "arrayView";
ParentContainerView.displayName = "ParentContainerView";

export default {
  grid: GridNodeView,
  prompt: PromptNodeView,
  objectView: ObjectNodeView,
  arrayView,
  text,
  parentContainer: ParentContainerView,
};
