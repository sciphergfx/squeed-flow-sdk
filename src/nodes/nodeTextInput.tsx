import { Flex } from "@chakra-ui/react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useThemeContentColors } from "../theme/useCustomColors";
import { getChakraColorHex } from "../theme/colorUtils";
import { EditableLabel } from "./EditableLabel";

export const NodeTextInput = ({ id, isActive, data, isEditing, onEditStart, onEditEnd }: any) => {
  const { themeColor } = useFlowDiagramContext();
  const color = data?.viewProps?.bgColor || themeColor;
  const { borderColor, highlightColor, textColor } = useThemeContentColors(color);
  const hextextColor = getChakraColorHex(data?.viewProps?.textColor || textColor);
  const hexborderColor = getChakraColorHex(data?.viewProps?.borderColor || borderColor);
  const hexbgColor = color?.startsWith("#") ? color : getChakraColorHex(highlightColor);

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
      whiteSpace="nowrap"
    >
      <Flex justifyContent="start" py={14} fontSize="5xl" lineHeight="normal" w={900}>
        <EditableLabel
          nodeId={id}
          label={data?.label || data?.text || ""}
          color={hextextColor}
          isEditing={isEditing}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
        />
      </Flex>
    </Flex>
  );
};
