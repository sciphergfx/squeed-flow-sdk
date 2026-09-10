import { Box, Icon } from "@chakra-ui/react";
import type { ComponentProps } from "react";
import { PiCircleFill } from "react-icons/pi";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import {
  ToolbarIconButton,
  ToolbarTooltip,
} from "../components/toolbarControls";
import NodeView from "./NodeView";
import { NodeTextInput } from "./nodeTextInput";

type CompactNodeViewProps = Omit<
  ComponentProps<typeof NodeView>,
  "children"
> & {
  onExpand?: () => void;
  toggleLabel?: string;
  toggleDisabled?: boolean;
  renderCompact?: typeof NodeTextInput;
};

export function CompactNodeView({
  onExpand,
  toggleLabel = "Show properties",
  toggleDisabled = false,
  renderCompact: RenderCompact = NodeTextInput,
  ...props
}: CompactNodeViewProps) {
  const { colorMode, callbacks } = useFlowDiagramContext();
  return (
    <NodeView {...props}>
      {(args) => (
        <Box position="relative">
          <RenderCompact {...args} />
          {onExpand && (args.isHovered || args.isActive) && (
            <Box
              position="absolute"
              top="-24px"
              right="-48px"
              data-flow-content-toggle=""
            >
              <ToolbarTooltip label={toggleLabel}>
                <ToolbarIconButton
                  aria-label={toggleLabel}
                  icon={<Icon as={PiCircleFill} boxSize={4} />}
                  variant="ghost"
                  w={12}
                  h={12}
                  minW={12}
                  color={colorMode === "dark" ? "gray.100" : "gray.800"}
                  disabled={toggleDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    onExpand();
                    callbacks.onNodeViewToggle?.(props.data.id);
                  }}
                />
              </ToolbarTooltip>
            </Box>
          )}
        </Box>
      )}
    </NodeView>
  );
}
