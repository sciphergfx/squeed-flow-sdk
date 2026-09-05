import { Box, Flex } from "@chakra-ui/react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useThemeContentColors } from "../theme/useCustomColors";
import { getChakraColorHex } from "../theme/colorUtils";
import DynamicIcon from "../utils/DynamicIcon";
import { EditableLabel } from "./EditableLabel";

export const NodeText = ({
  id,
  data,
  isActive,
  isEditing,
  onEditStart,
  onEditEnd,
}: any) => {
  const { themeColor } = useFlowDiagramContext();
  const { bgColor, borderColor, textColor } = useThemeContentColors(
    data?.viewProps?.bgColor || themeColor,
  );
  const hextextColor = getChakraColorHex(
    data?.viewProps?.textColor || textColor,
  );

  return (
    <Box
      borderRadius={data?.viewProps?.borderRadius}
      bgColor={bgColor}
      borderColor={!isActive ? borderColor : "white"}
      _hover={{ borderColor: "white" }}
      borderWidth={2}
      py={14}
      px={20}
      whiteSpace="nowrap"
      w="fit-content"
    >
      <Flex
        justifyContent="start"
        alignItems="center"
        gap={8}
        w="fit-content"
        maxW={900}
        minW={0}
        fontSize="5xl"
        lineHeight="normal"
      >
        {data?.config?.icon && (
          <Box flexShrink={0}>
            <DynamicIcon
              name={data.config.icon}
              size={80}
              color={hextextColor}
            />
          </Box>
        )}
        <EditableLabel
          nodeId={id}
          label={data?.label || data?.text || ""}
          color={hextextColor}
          isEditing={isEditing}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
        />
      </Flex>
    </Box>
  );
};
