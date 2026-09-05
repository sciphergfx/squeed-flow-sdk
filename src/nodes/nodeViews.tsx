import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { useState } from "react";
import { PiArticle, PiTable } from "react-icons/pi";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import {
  ToolbarIconButton,
  ToolbarTooltip,
} from "../components/toolbarControls";
import { contentObjTheme, getChakraColorHex } from "../theme/colorUtils";
import { useThemeContentColors } from "../theme/useCustomColors";
import DynamicIcon from "../utils/DynamicIcon";
import { EditableLabel } from "./EditableLabel";
import { EditableContent } from "./EditableContent";
import NodeView from "./NodeView";
import { NodeText } from "./nodeText";
import { NodeTextInput } from "./nodeTextInput";
import { getNodeBorderProps } from "./nodeBorder";

const getColorVars = (data, themeColor, colorMode) => {
  const bg = data?.viewProps?.bgColor || themeColor;
  const [wordBeforeDot] = bg.split(".");
  const colors = useThemeContentColors(bg);
  const outline = data?.viewProps?.outline === true;
  const isTransparent = bg === "transparent" || outline;
  const canvasText = colorMode === "dark" ? "gray.200" : "gray.900";

  const hexbgColor = isTransparent
    ? "transparent"
    : bg?.startsWith("#")
      ? getChakraColorHex(bg)
      : getChakraColorHex(colors.bgColor);
  const hextextColor = getChakraColorHex(
    data?.viewProps?.textColor ||
      (isTransparent ? canvasText : colors.textColor),
  );
  const hexborderColor = getChakraColorHex(
    data?.viewProps?.borderColor ||
      (outline ? (bg === "transparent" ? themeColor : bg) : colors.borderColor),
  );

  return {
    ...colors,
    bgColor: isTransparent ? "transparent" : colors.bgColor,
    highlightColor: isTransparent ? "transparent" : colors.highlightColor,
    isTransparent,
    propertyColor: isTransparent ? canvasText : colors.propertyColor,
    bg,
    wordBeforeDot,
    hexbgColor,
    hextextColor,
    hexborderColor,
  };
};

const truncateText = (value, maxLength = 350) =>
  `${String(value).substring(0, maxLength)}${String(value).length > maxLength ? "..." : ""}`;

const formatHeaderTitle = (title) =>
  title?.includes("root") ? title.replace("root", "untitled") : title;

const OBJECT_VALUE_WIDTH = 600;
const OBJECT_BORDER_WIDTH = 3;

const calculateUniformKeyWidth = (description) => {
  const longestKeyLength = Math.max(
    ...Object.keys(description || {}).map((key) => key.length),
    0,
  );
  const charWidth = 28;
  return Math.max(longestKeyLength * charWidth + 30, 200);
};

const text = (props) => (
  <NodeView {...props}>{(args) => <NodeText {...args} />}</NodeView>
);

const arrayView = (props) => (
  <NodeView {...props}>{(args) => <NodeTextInput {...args} />}</NodeView>
);

const NodeJsonObjectView = (props) => {
  const { themeColor, colorMode } = useFlowDiagramContext();
  const [objVisible, setObjVisible] = useState(false);

  return (
    <NodeView {...props}>
      {({ id, data, isActive, isEditing, onEditStart, onEditEnd }) => {
        const colors = getColorVars(data, themeColor, colorMode);
        const headerTitle = data.label ?? data.headerTitle;
        const hasConfig = Object.entries(data.description || {}).length > 0;
        const uniformKeyWidth = calculateUniformKeyWidth(data.description);
        const icon = props.data?.config?.icon;
        const content = props.data?.config?.content;
        const hasContent = typeof content === "string";
        const borderProps = getNodeBorderProps(
          data?.viewProps,
          colors.hexborderColor,
          isActive,
          OBJECT_BORDER_WIDTH,
        );

        return (
          <Flex
            justifyContent="space-between"
            {...data?.viewProps}
            data-flow-node-surface=""
            direction="column"
            p={0}
            borderRadius={data?.viewProps?.borderRadius}
            overflow="hidden"
            alignItems="center"
            style={{
              backgroundColor: colors.hexbgColor,
              transition: "border-color 0.2s ease-in-out",
            }}
            width="100%"
            minW={
              hasContent
                ? uniformKeyWidth +
                  OBJECT_VALUE_WIDTH +
                  borderProps.borderWidth * 2
                : undefined
            }
            {...borderProps}
          >
            <Flex
              width="100%"
              direction="column"
              borderRadius={data?.viewProps?.borderRadius}
              borderColor={colors.hexborderColor}
              borderWidth={0}
              overflow="hidden"
            >
              {(headerTitle || hasContent) && (
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
                    !hasConfig && !hasContent
                      ? "transparent"
                      : colors.hexborderColor
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
                  {hasContent && (
                    <Box
                      ml="auto"
                      pl={6}
                      flexShrink={0}
                      data-flow-content-toggle=""
                    >
                      <ToolbarTooltip
                        label={objVisible ? "Show content" : "Show properties"}
                      >
                        <ToolbarIconButton
                          aria-label={
                            objVisible ? "Show content" : "Show properties"
                          }
                          icon={
                            <Icon
                              as={objVisible ? PiArticle : PiTable}
                              boxSize={8}
                            />
                          }
                          variant="ghost"
                          w={12}
                          h={12}
                          minW={12}
                          color={colors.hextextColor}
                          onClick={(event) => {
                            event.stopPropagation();
                            setObjVisible(!objVisible);
                          }}
                        />
                      </ToolbarTooltip>
                    </Box>
                  )}
                </Flex>
              )}
              {hasContent && !objVisible ? (
                <Flex
                  w="100%"
                  overflow="auto"
                  justifyContent="start"
                  background={colors.highlightColor}
                  p={10}
                  fontSize="5xl"
                  lineHeight="normal"
                >
                  <EditableContent
                    nodeId={id}
                    content={content}
                    color={data?.viewProps?.textColor || colors.hextextColor}
                  />
                </Flex>
              ) : (
                <Box>
                  {Object.entries(data.description || {}).map(
                    ([key, value], index) => {
                      const typeColor = contentObjTheme(colors.wordBeforeDot)[
                        typeof value
                      ];
                      const keyColor = contentObjTheme(colors.wordBeforeDot)[
                        "property"
                      ];

                      return (
                        <Box key={key} data-flow-property={key}>
                          <Flex flexWrap="nowrap" overflow="hidden">
                            <Flex
                              justifyContent="start"
                              align="center"
                              background={colors.highlightColor}
                              width={`${uniformKeyWidth}px`}
                              minWidth={`${uniformKeyWidth}px`}
                              borderRightColor={colors.hexborderColor}
                              borderRightWidth={1}
                            >
                              <Text
                                py={5}
                                px={10}
                                w="100%"
                                whiteSpace="nowrap"
                                fontWeight="bold"
                                fontSize="4xl"
                                color={
                                  data?.viewProps?.textColor ||
                                  (colors.isTransparent
                                    ? colors.hextextColor
                                    : keyColor)
                                }
                              >
                                {key}
                              </Text>
                            </Flex>
                            <Flex
                              flex={1}
                              justifyContent="start"
                              overflow="hidden"
                              p={4}
                              background={colors.hexbgColor}
                              w={OBJECT_VALUE_WIDTH}
                              maxH={200}
                            >
                              <Text
                                overflow="hidden"
                                py={3}
                                px={4}
                                whiteSpace="normal"
                                textOverflow="ellipsis"
                                fontSize="4xl"
                                color={
                                  data?.viewProps?.textColor ||
                                  (colors.isTransparent
                                    ? colors.hextextColor
                                    : typeColor)
                                }
                                fontWeight={400}
                              >
                                {truncateText(value)}
                              </Text>
                            </Flex>
                          </Flex>
                          {index !==
                            Object.entries(data.description || {}).length -
                              1 && (
                            <Box
                              borderTopWidth={1}
                              my={0}
                              borderColor={colors.hexborderColor}
                            />
                          )}
                        </Box>
                      );
                    },
                  )}
                </Box>
              )}
            </Flex>
          </Flex>
        );
      }}
    </NodeView>
  );
};

const ParentContainerView = (props) => {
  const { themeColor, colorMode } = useFlowDiagramContext();

  return (
    <NodeView {...props}>
      {({ data, isActive }) => {
        const colors = getColorVars(data, themeColor, colorMode);
        const icon = props.data?.config?.icon;

        return (
          <Flex
            justifyContent="space-between"
            {...data?.viewProps}
            direction="column"
            p={0}
            borderRadius={data?.viewProps?.borderRadius || 15}
            overflow="hidden"
            bgColor={colors.bgColor}
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            style={{
              backgroundColor: colors.hexbgColor,
              transition: "border-color 0.2s ease-in-out",
            }}
            borderColor={!isActive ? colors.hexborderColor : "white"}
            _hover={{ borderColor: "white" }}
            borderWidth={3}
          >
            {data.headerTitle && (
              <Flex
                justify="flex-start"
                direction="row"
                p={20}
                borderBottomWidth={1}
                minWidth="max-content !important"
                width="100%"
                textTransform="capitalize"
                align="center"
                alignItems="center"
                fontWeight="bold"
                color={colors.propertyColor}
                bgColor={colors.highlightColor}
                borderBottomColor={colors.hexborderColor}
              >
                {!!icon && (
                  <Box
                    mr={8}
                    justifyContent="flex-start"
                    height="100%"
                    w={50}
                    alignItems="center"
                    rounded="full"
                  >
                    <DynamicIcon
                      key={colors.hextextColor}
                      name={icon}
                      size={80}
                      color={colors.hextextColor}
                    />
                  </Box>
                )}
                <Text
                  fontSize="5xl"
                  lineClamp={2}
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  color={data?.viewProps?.textColor}
                >
                  {formatHeaderTitle(data.headerTitle)}
                </Text>
              </Flex>
            )}
          </Flex>
        );
      }}
    </NodeView>
  );
};

text.displayName = "text";
arrayView.displayName = "arrayView";
NodeJsonObjectView.displayName = "NodeJsonObjectView";
ParentContainerView.displayName = "ParentContainerView";

const Views = {
  objectView: NodeJsonObjectView,
  arrayView,
  text,
  parentContainer: ParentContainerView,
};

export default Views;
