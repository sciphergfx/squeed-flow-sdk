import { Flex, Icon, Tooltip } from "@chakra-ui/react";
import { useCustomColors } from "../theme/useCustomColors";

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
    <Tooltip.Root positioning={{ placement: props.placement || "top" }}>
      <Tooltip.Trigger asChild>
        <Flex>
          <Icon
            as={icon}
            boxSize={boxSize}
            color={color}
            cursor={onClick ? "pointer" : undefined}
            onClick={onClick}
          />
        </Flex>
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content
          bgColor={props.bgColor || background}
          borderColor={props.borderColor || border}
          borderWidth={1}
          color={props.textColor || colorText}
          borderRadius={15}
          fontWeight={300}
          fontSize="sm"
          p={2}
          px={4}
          shadow="none"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
};

export default TooltipIconButton;
