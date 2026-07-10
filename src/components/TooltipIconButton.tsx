import { Flex, Icon, Tooltip } from "@chakra-ui/react";
import { useCustomColors } from "../theme/useCustomColors";

const TooltipIconButton = ({ icon, label, onClick, color, boxSize = 6, ...props }) => {
  const { background, border, colorText } = useCustomColors();
  return (
    <Tooltip
      bgColor={props.bgColor || background}
      borderColor={props.borderColor || border}
      borderWidth={1}
      color={props.textColor || colorText}
      label={label}
      borderRadius={15}
      placement={props.placement || "top"}
      fontWeight={300}
      fontSize="sm"
      p={2}
      px={4}
      shadow="none"
    >
      <Flex>
        <Icon as={icon} boxSize={boxSize} color={color} cursor={onClick ? "pointer" : undefined} onClick={onClick} />
      </Flex>
    </Tooltip>
  );
};

export default TooltipIconButton;
