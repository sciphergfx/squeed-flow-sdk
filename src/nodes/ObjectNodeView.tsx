import { Flex } from "@chakra-ui/react";
import { useRef } from "react";
import { useCloseOnDeselect } from "../hooks/useCloseOnDeselect";
import { useNodeViewActions } from "../hooks/useNodeViewActions";
import { CompactNodeView } from "./CompactNodeView";
import { EditableContent } from "./EditableContent";
import { getNodeBorderProps } from "./nodeBorder";
import NodeView from "./NodeView";
import { ObjectNodeHeader } from "./ObjectNodeHeader";
import { ObjectPropertyTable } from "./ObjectPropertyTable";
import {
  calculateUniformKeyWidth,
  getColorVars,
  OBJECT_BORDER_WIDTH,
  OBJECT_VALUE_WIDTH,
} from "./objectViewTheme";
import { useObjectInspection } from "./useObjectInspection";

export const ObjectNodeView = (props) => {
  const {
    themeColor,
    colorMode,
    direction,
    objVisible,
    setObjVisible,
    inspecting,
    resourcePorts,
    form,
    description,
    inspectionPorts,
    extraPorts,
  } = useObjectInspection(props);
  const actions = useNodeViewActions();
  const iconVisible = actions.getNodeViewMode(props.data.id) === "icon-label";
  const hasContent =
    !props.onShowIcon &&
    (typeof props.data.config?.content === "string" ||
      (props.data.config?.contentFormat === "jsx" &&
        Array.isArray(props.data.config?.content)));
  const openedFromIcon = useRef(iconVisible);
  if (iconVisible) openedFromIcon.current = true;
  useCloseOnDeselect(
    props.data.id,
    hasContent &&
      !props.data.config?.parentContainer &&
      actions.allNodesIconLabel &&
      !iconVisible &&
      openedFromIcon.current,
    () => actions.setNodeViewMode(props.data.id, "icon-label"),
  );
  const canShowNativeIcon =
    !props.onShowIcon && !props.data.config?.parentContainer && !hasContent;
  const onShowNativeIcon = canShowNativeIcon
    ? () => actions.setNodeViewMode(props.data.id, "icon-label")
    : undefined;
  if (!props.onShowIcon && iconVisible)
    return (
      <CompactNodeView
        {...props}
        data={{
          ...props.data,
          label: props.data.label ?? props.data.headerTitle,
          config: {
            ...props.data.config,
            labelBelow: true,
            icon: props.data.config?.icon || "PiBracketsCurly",
          },
        }}
        onExpand={() => actions.restoreNodeView(props.data.id)}
      />
    );
  return (
    <NodeView {...props} data={{ ...props.data, description }}>
      {({ id, data, isActive, isEditing, onEditStart, onEditEnd }) => {
        const colors = getColorVars(data, themeColor, colorMode);
        const headerTitle = data.label ?? data.headerTitle;
        const hasConfig = Object.entries(data.description || {}).length > 0;
        const uniformKeyWidth = calculateUniformKeyWidth(data.description);
        const icon = props.data?.config?.icon;
        const content = props.data?.config?.content;
        const borderRadius = data?.viewProps?.borderRadius ?? "53px";
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
            borderRadius={borderRadius}
            overflow="hidden"
            alignItems="center"
            style={{
              backgroundColor: colors.hexbgColor,
              transition: "border-color 0.2s ease-in-out",
            }}
            width="100%"
            minW={
              hasContent || props.onShowIcon
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
              borderRadius={borderRadius}
              borderColor={colors.hexborderColor}
              borderWidth={0}
              overflow="hidden"
            >
              <ObjectNodeHeader
                {...{
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
                }}
              />
              {hasContent && !objVisible ? (
                <Flex
                  w="100%"
                  overflow="auto"
                  justifyContent="start"
                  background={colors.highlightColor}
                  p={
                    ["html", "jsx"].includes(props.data?.config?.contentFormat)
                      ? 0
                      : 12
                  }
                  fontSize="5xl"
                  lineHeight="normal"
                >
                  <EditableContent
                    nodeId={id}
                    content={content}
                    format={props.data?.config?.contentFormat}
                    color={data?.viewProps?.textColor || colors.hextextColor}
                  />
                </Flex>
              ) : (
                <ObjectPropertyTable
                  {...{
                    data,
                    resourcePorts,
                    inspecting,
                    form,
                    inspectionPorts,
                    extraPorts,
                    colors,
                    direction,
                    uniformKeyWidth,
                  }}
                />
              )}
            </Flex>
          </Flex>
        );
      }}
    </NodeView>
  );
};

ObjectNodeView.displayName = "NodeJsonObjectView";
