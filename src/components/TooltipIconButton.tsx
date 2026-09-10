import { Flex, Icon } from "@chakra-ui/react";
import { useCustomColors } from "../theme/useCustomColors";
import { ToolbarTooltip } from "./toolbarControls";

const TooltipIconButton = ({
  icon,
  label,
  onClick,
  color,
  boxSize = 6,
  ...props
}) => {
  const { background, border, colorText } = useCustomColors();
  return (
    <ToolbarTooltip label={label}>
      <Flex asChild p={0} border={0} bg="transparent">
        <button type="button" aria-label={label} onClick={onClick}>
          <Icon
            as={icon}
            boxSize={boxSize}
            color={color}
            cursor={onClick ? "pointer" : undefined}
          />
        </button>
      </Flex>
    </ToolbarTooltip>
  );
};

export default TooltipIconButton;
