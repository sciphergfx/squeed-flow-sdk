import { Flex } from "@chakra-ui/react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { getChakraColorHex } from "../theme/colorUtils";
import {
  useCustomColors,
  useThemeContentColors,
} from "../theme/useCustomColors";
import DynamicIcon from "../utils/DynamicIcon";
import { EditableLabel } from "./EditableLabel";
import { getNodeBorderProps } from "./nodeBorder";

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
  const outline = data?.viewProps?.outline === true;
  const color = (!isTransparent && data?.viewProps?.bgColor) || themeColor;
  const { borderColor, highlightColor, textColor } =
    useThemeContentColors(color);
  // a transparent pill sits on the canvas, so its default text follows the color mode
  const hextextColor = getChakraColorHex(
    data?.viewProps?.textColor ||
      (isTransparent || outline ? colorText : textColor),
  );
  const hexborderColor =
    isTransparent && !outline && !data?.viewProps?.borderColor
      ? "transparent"
      : getChakraColorHex(
          data?.viewProps?.borderColor || (outline ? color : borderColor),
        );
  const hexbgColor =
    isTransparent || outline
      ? "transparent"
      : color?.startsWith("#")
        ? color
        : getChakraColorHex(highlightColor);
  const icon = data?.config?.icon;
  // `$label: ""` is a deliberate icon-only node; only fall back to `text` when no label was given
  const label: string = data?.label ?? data?.text ?? "";

  if (data?.config?.labelBelow) {
    const iconSize = (data?.viewProps?.fontSize || 1) * 100;
    return (
      <Flex
        data-flow-icon-label=""
        css={{ "--flow-grid-on-surface-color": hextextColor }}
        direction="column"
        align="center"
        gap="24px"
        width={`${Math.max(iconSize + 200, 360)}px`}
        position="relative"
      >
        <Flex
          data-flow-node-surface=""
          align="center"
          justify="center"
          width={`${iconSize + 100}px`}
          height={`${iconSize + 100}px`}
          flexShrink={0}
          borderRadius={data?.viewProps?.borderRadius}
          backgroundColor={hexbgColor}
          {...getNodeBorderProps(data?.viewProps, hexborderColor, isActive, 2)}
        >
          {!!icon && (
            <DynamicIcon name={icon} size={iconSize} color={hextextColor} />
          )}
        </Flex>
        <Flex
          data-flow-icon-caption=""
          direction="column"
          align="center"
          gap="8px"
          justify="center"
          width="100%"
          minW={0}
          textAlign="center"
        >
          <EditableLabel
            nodeId={id}
            label={label}
            color={`var(--flow-grid-caption-color, ${getChakraColorHex(data?.viewProps?.textColor || colorText)})`}
            isEditing={isEditing}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
            wrap
          />
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex
      data-flow-node-surface=""
      align="center"
      borderRadius={data?.viewProps?.borderRadius}
      bgColor={hexbgColor}
      style={{ backgroundColor: hexbgColor }}
      textTransform="capitalize"
      {...getNodeBorderProps(data?.viewProps, hexborderColor, isActive, 2)}
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
