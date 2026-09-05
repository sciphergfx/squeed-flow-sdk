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
      <Flex>
        <Icon
          as={icon}
          boxSize={boxSize}
          color={color}
          cursor={onClick ? "pointer" : undefined}
          onClick={onClick}
        />
      </Flex>
    </ToolbarTooltip>
  );
};

export default TooltipIconButton;
