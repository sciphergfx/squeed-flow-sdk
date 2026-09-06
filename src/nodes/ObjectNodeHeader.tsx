import { Box, Flex, Icon } from "@chakra-ui/react";
import { PiCircleFill } from "react-icons/pi";
import {
  ToolbarIconButton,
  ToolbarTooltip,
} from "../components/toolbarControls";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import DynamicIcon from "../utils/DynamicIcon";
import { EditableLabel } from "./EditableLabel";
import { formatHeaderTitle } from "./objectViewTheme";

export function ObjectNodeHeader({
  headerTitle,
  hasContent,
  data,
  icon,
  colors,
  hasConfig,
  id,
  isActive,
  isEditing,
  onEditStart,
  onEditEnd,
  props,
  objVisible,
  setObjVisible,
  onShowNativeIcon,
}) {
  const { callbacks } = useFlowDiagramContext();
  const showIcon = props.onShowIcon ?? onShowNativeIcon;
  const toggleLabel = showIcon
    ? "Show icon"
    : objVisible
      ? "Show content"
      : "Show properties";
  return (
    <>
      {(headerTitle ||
        hasContent ||
        data.config?.form ||
        (isActive && onShowNativeIcon)) && (
        <Flex
          justify="flex-start"
          direction="row"
          p={Object.entries(data.description || {}).length ? 8 : 20}
          borderBottomWidth={1}
          minWidth="max-content !important"
          width="100%"
          textTransform="capitalize"
          align="center"
          textOverflow="ellipsis"
          alignItems="center"
          fontWeight="bold"
          color={colors.propertyColor}
          bgColor={colors.highlightColor}
          borderBottomColor={
            !hasConfig && !hasContent ? "transparent" : colors.hexborderColor
          }
        >
          {!!icon && (
            <Flex mr={6} alignItems="center" flexShrink={0}>
              <DynamicIcon
                key={colors.hextextColor}
                name={icon}
                size={64}
                color={colors.hextextColor}
              />
            </Flex>
          )}
          <EditableLabel
            nodeId={id}
            label={formatHeaderTitle(headerTitle)}
            color={data?.viewProps?.textColor || colors.propertyColor}
            isEditing={isEditing}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
          />
          {isActive && (hasContent || showIcon) && (
            <Box ml="auto" pl={6} flexShrink={0} data-flow-content-toggle="">
              <ToolbarTooltip label={toggleLabel}>
                <ToolbarIconButton
                  aria-label={toggleLabel}
                  icon={<Icon as={PiCircleFill} boxSize={4} />}
                  variant="ghost"
                  w={12}
                  h={12}
                  minW={12}
                  color={colors.hextextColor}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (showIcon) showIcon();
                    else setObjVisible(!objVisible);
                    callbacks.onNodeViewToggle?.(id);
                  }}
                />
              </ToolbarTooltip>
            </Box>
          )}
        </Flex>
      )}
    </>
  );
}
