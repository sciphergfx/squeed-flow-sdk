import { Flex } from "@chakra-ui/react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import {
  useCustomColors,
  useThemeContentColors,
} from "../theme/useCustomColors";
import { getChakraColorHex } from "../theme/colorUtils";
import DynamicIcon from "../utils/DynamicIcon";
import { EditableLabel } from "./EditableLabel";

export const NodeTextInput = ({
  id,
  isActive,
  data,
  isEditing,
  onEditStart,
  onEditEnd,
}: any) => {
  const { themeColor } = useFlowDiagramContext();
  const { colorText } = useCustomColors();
  const isTransparent = data?.viewProps?.bgColor === "transparent";
  const color = (!isTransparent && data?.viewProps?.bgColor) || themeColor;
  const { borderColor, highlightColor, textColor } =
    useThemeContentColors(color);
  // a transparent pill sits on the canvas, so its default text follows the color mode
  const hextextColor = getChakraColorHex(
    data?.viewProps?.textColor || (isTransparent ? colorText : textColor),
  );
  const hexborderColor =
    isTransparent && !data?.viewProps?.borderColor
      ? "transparent"
      : getChakraColorHex(data?.viewProps?.borderColor || borderColor);
  const hexbgColor = isTransparent
    ? "transparent"
    : color?.startsWith("#")
      ? color
      : getChakraColorHex(highlightColor);
  const icon = data?.config?.icon;
  // `$label: ""` is a deliberate icon-only node; only fall back to `text` when no label was given
  const label: string = data?.label ?? data?.text ?? "";

  return (
    <Flex
      align="center"
      borderRadius={data?.viewProps?.borderRadius}
      bgColor={hexbgColor}
      style={{ backgroundColor: hexbgColor }}
      textTransform="capitalize"
      borderColor={!isActive ? hexborderColor : "white"}
      _hover={{ borderColor: "white" }}
      borderWidth={2}
      px={50}
      w="fit-content"
      whiteSpace="nowrap"
    >
      {!!icon && (
        <Flex align="center" py={14} mr={label ? 8 : 0} flexShrink={0}>
          <DynamicIcon
            key={hextextColor}
            name={icon}
            size={(data?.viewProps?.fontSize || 1) * 100}
            color={hextextColor}
          />
        </Flex>
      )}
      {(label || !icon) && (
        <Flex
          justifyContent="start"
          py={14}
          fontSize="5xl"
          lineHeight="normal"
          w="fit-content"
          maxW={900}
          minW={0}
        >
          <EditableLabel
            nodeId={id}
            label={label}
            color={hextextColor}
            isEditing={isEditing}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
          />
        </Flex>
      )}
    </Flex>
  );
};
