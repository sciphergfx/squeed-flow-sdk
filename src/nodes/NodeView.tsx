import { Box, HStack, IconButton } from "@chakra-ui/react";
import { memo, useCallback, useRef, useState } from "react";
import { PiMinusBold, PiPlusBold } from "react-icons/pi";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { FlowPort, type FlowPortProps } from "../components/FlowPort";
import { NodeFormPopover } from "../components/NodeFormPopover";
import TooltipIconButton from "../components/TooltipIconButton";
import { useNodeHasChildren } from "../hooks/useNodeHasChildren";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";

interface NodeViewProps {
  data: any;
  isInverted?: boolean;
  isParent?: boolean;
  onOpenView?: () => void;
  editOnMount?: boolean;
  children: (args: NodeViewChildArgs) => React.ReactNode;
}

interface NodeViewChildArgs {
  id: string;
  data: any;
  isActive: boolean;
  isLowZoom: boolean;
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
}

const NodeView = ({
  data: nodeData,
  children,
  isInverted,
  isParent,
  onOpenView,
  editOnMount = false,
}: NodeViewProps) => {
  const {
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    isMultiSelectMode,
    nodeGridOptions,
    isPerformanceMode,
    engineRef,
    callbacks,
    config,
    themeColor,
    direction,
    nodeViewModes,
  } = useFlowDiagramContext();
  const { background, border, colorText } = useCustomColors();
  const nodeRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(
    editOnMount && !!config.editable && !config.readOnly,
  );
  const [formOpen, setFormOpen] = useState(false);

  const id = nodeData?.id;
  const hasChildren = useNodeHasChildren(id);
  const isActive = selectedNodeIds.includes(id);
  const overlayActions = config.nodeOverlayActions;
  const renderNodeOverlay = config.renderNodeOverlay;
  const overlayTop = nodeData?.type === "grid" ? "20px" : "-100px";
  const overlayOrigin = nodeData?.type === "grid" ? "top center" : undefined;

  const isLowZoom = (() => {
    try {
      const zoom = engineRef.current?.zoom();
      return zoom !== undefined && zoom < 0.08;
    } catch {
      return false;
    }
  })();

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (isEditing || config.readOnly) return;
      const modifiers = {
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
      };
      // one selection toolbar at a time
      if (selectedEdgeId) {
        setSelectedEdgeId(null);
        callbacks.onEdgeDeselect?.();
      }
      if (isMultiSelectMode || (event.shiftKey && nodeGridOptions?.fill)) {
        const isAlreadySelected = selectedNodeIds.includes(id);
        const newIds = isAlreadySelected
          ? selectedNodeIds.filter((nid) => nid !== id)
          : [...selectedNodeIds, id];
        setSelectedNodeIds(newIds);
        if (isAlreadySelected) {
          callbacks.onNodeDeselect?.();
        } else {
          callbacks.onNodeSelect?.(id, nodeData, modifiers);
        }
      } else {
        setSelectedNodeIds([id]);
        callbacks.onNodeSelect?.(id, nodeData, modifiers);
      }
    },
    [
      id,
      nodeData,
      selectedNodeIds,
      selectedEdgeId,
      isMultiSelectMode,
      nodeGridOptions,
      isEditing,
      setSelectedNodeIds,
      setSelectedEdgeId,
      callbacks,
      config,
    ],
  );

  const handleDoubleClick = useCallback(() => {
    if (isEditing || config.readOnly) return;
    callbacks.onNodeDoubleClick?.(id, nodeData);
  }, [id, nodeData, isEditing, callbacks, config]);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 100);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  }, []);

  const formAvailable = !!nodeData?.config?.form;
  const formHandlers = {
    tabIndex: formAvailable ? 0 : undefined,
    "aria-haspopup": formAvailable ? ("dialog" as const) : undefined,
    "aria-expanded": formAvailable ? formOpen : undefined,
    onDoubleClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
      if (
        (!formAvailable && !onOpenView) ||
        config.readOnly ||
        isEditing ||
        !event.currentTarget.contains(event.target as Node) ||
        (event.target instanceof Element &&
          event.target.closest(
            "button, input, textarea, select, a, [contenteditable=true], [data-flow-content]",
          ))
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedNodeIds([id]);
      if (onOpenView) onOpenView();
      else setFormOpen(true);
      callbacks.onNodeDoubleClick?.(id, nodeData);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        (!formAvailable && !onOpenView) ||
        config.readOnly ||
        event.target !== event.currentTarget ||
        event.key !== "Enter"
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedNodeIds([id]);
      if (onOpenView) onOpenView();
      else setFormOpen(true);
    },
  };
  const formPopover = formAvailable && (
    <NodeFormPopover
      nodeAddress={id}
      active={isActive}
      label={nodeData.label || nodeData.headerTitle || "Node"}
      open={formOpen}
      onClose={() => {
        setFormOpen(false);
        if (isActive) nodeRef.current?.focus({ preventScroll: true });
      }}
    />
  );
  const shapePorts = Array.isArray(nodeData?.config?.ports)
    ? nodeData.config.ports.map((port: FlowPortProps) => (
        <FlowPort key={`${port.id}:${port.role}`} {...port} />
      ))
    : null;

  if (isParent) {
    return (
      <Box
        ref={nodeRef}
        {...formHandlers}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        cursor="pointer"
        position="relative"
      >
        {formPopover}
        {!isPerformanceMode &&
          (renderNodeOverlay ||
            (overlayActions && overlayActions.length > 0)) &&
          isHovered &&
          !isLowZoom && (
            <>
              <Box
                position="absolute"
                top={-150}
                left="0"
                right="0"
                height="150px"
                pointerEvents="auto"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={handleMouseLeave}
              />
              {renderNodeOverlay ? (
                <Box
                  position="absolute"
                  zIndex={1000}
                  top={overlayTop}
                  transformOrigin={overlayOrigin}
                  left="50%"
                  pointerEvents="auto"
                  transform="translateX(-50%) scale3d(3, 3, 1)"
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={handleMouseLeave}
                  willChange="transform"
                >
                  {renderNodeOverlay({
                    nodeId: id,
                    nodeData,
                    isRoot: id === "root",
                    isParent: true,
                    isHovered,
                    setIsHovered,
                  })}
                </Box>
              ) : (
                <Box
                  position="absolute"
                  zIndex={1000}
                  top={overlayTop}
                  transformOrigin={overlayOrigin}
                  left="50%"
                  bg={background}
                  p={3}
                  borderColor={border}
                  borderWidth={1}
                  borderRadius={15}
                  pointerEvents="auto"
                  transform="translateX(-50%) scale3d(3, 3, 1)"
                  boxShadow="lg"
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={handleMouseLeave}
                  willChange="transform"
                >
                  <HStack px={2} gap={2}>
                    {overlayActions!.map((action, i) => (
                      <Box key={action.id} display="contents">
                        {i > 0 && (
                          <Box
                            borderColor={border}
                            height={5}
                            borderRightWidth={1}
                          />
                        )}
                        <TooltipIconButton
                          icon={action.icon}
                          label={action.label}
                          color={colorText}
                          bgColor={background}
                          borderColor={border}
                          textColor={colorText}
                          boxSize={5}
                          onClick={(e) => {
                            e.stopPropagation();
                            callbacks.onNodeHoverAction?.(
                              action.id,
                              id,
                              nodeData,
                            );
                          }}
                        />
                      </Box>
                    ))}
                  </HStack>
                </Box>
              )}
            </>
          )}
        {children({
          id,
          data: nodeData,
          isActive,
          isLowZoom,
          isEditing,
          onEditStart: () => setIsEditing(true),
          onEditEnd: () => setIsEditing(false),
        })}
        {hasChildren &&
          !nodeData?.config?.parentContainer &&
          nodeData?.config?.collapsed !== undefined &&
          (() => {
            const pillVertical = direction === "TB" || direction === "BT";
            const pillOnLeft = isInverted || direction === "RL";
            return (
              <IconButton
                position="absolute"
                {...(pillVertical
                  ? {
                      [direction === "BT" ? "top" : "bottom"]: "-75px",
                      left: "50%",
                      transform: "translateX(-50%)",
                    }
                  : {
                      right: pillOnLeft ? undefined : "-75px",
                      left: pillOnLeft ? "-75px" : undefined,
                      top: "50%",
                      transform: "translateY(-50%)",
                    })}
                data-flow-collapse-control=""
                aria-label={nodeData.config.collapsed ? "Expand" : "Collapse"}
                disabled={config.readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  callbacks.onNodeCollapse?.(id, !nodeData.config.collapsed);
                }}
                bgColor={getChakraColorHex(
                  nodeData?.viewProps?.bgColor || themeColor,
                )}
                size="md"
                color="gray.100"
                rounded="full"
                mr={2}
                px={2}
                py={4}
              >
                {nodeData.config.collapsed ? (
                  <PiPlusBold size={30} color={getChakraColorHex("gray.800")} />
                ) : (
                  <PiMinusBold
                    size={30}
                    color={getChakraColorHex("gray.800")}
                  />
                )}
              </IconButton>
            );
          })()}
      </Box>
    );
  }

  return (
    <Box
      ref={nodeRef}
      {...formHandlers}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      cursor="pointer"
      transition="transform 0.1s ease"
      position="relative"
    >
      {formPopover}
      {shapePorts}
      {!isPerformanceMode &&
        (renderNodeOverlay || (overlayActions && overlayActions.length > 0)) &&
        isHovered &&
        !isLowZoom && (
          <>
            <Box
              position="absolute"
              top={-150}
              left="0"
              right="0"
              height="150px"
              pointerEvents="auto"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={handleMouseLeave}
            />
            {renderNodeOverlay ? (
              <Box
                position="absolute"
                zIndex={1000}
                top={overlayTop}
                transformOrigin={overlayOrigin}
                left="50%"
                pointerEvents="auto"
                transform="translateX(-50%) scale3d(3, 3, 1)"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={handleMouseLeave}
                willChange="transform"
              >
                {renderNodeOverlay({
                  nodeId: id,
                  nodeData,
                  isRoot: id === "root",
                  isParent: !!isParent,
                  isHovered,
                  setIsHovered,
                })}
              </Box>
            ) : (
              <Box
                position="absolute"
                zIndex={1000}
                top={overlayTop}
                transformOrigin={overlayOrigin}
                left="50%"
                bg={background}
                p={3}
                borderColor={border}
                borderWidth={1}
                borderRadius={15}
                pointerEvents="auto"
                transform="translateX(-50%) scale3d(3, 3, 1)"
                boxShadow="lg"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={handleMouseLeave}
                willChange="transform"
              >
                <HStack px={2} gap={2}>
                  {overlayActions!.map((action, i) => (
                    <Box key={action.id} display="contents">
                      {i > 0 && (
                        <Box
                          borderColor={border}
                          height={5}
                          borderRightWidth={1}
                        />
                      )}
                      <TooltipIconButton
                        icon={action.icon}
                        label={action.label}
                        color={colorText}
                        bgColor={background}
                        borderColor={border}
                        textColor={colorText}
                        boxSize={5}
                        onClick={(e) => {
                          e.stopPropagation();
                          callbacks.onNodeHoverAction?.(
                            action.id,
                            id,
                            nodeData,
                          );
                        }}
                      />
                    </Box>
                  ))}
                </HStack>
              </Box>
            )}
          </>
        )}
      <Box position="relative" display="flex" h="100%" w="100%">
        {hasChildren &&
          !nodeData?.config?.parentContainer &&
          nodeData?.config?.collapsed !== undefined &&
          !isParent &&
          (() => {
            const pillVertical = direction === "TB" || direction === "BT";
            const pillOnLeft = isInverted || direction === "RL";
            const iconHalfSize =
              nodeData?.config?.labelBelow && nodeViewModes[id] !== "properties"
                ? ((nodeData?.viewProps?.fontSize || 1) * 100 + 100) / 2
                : undefined;
            return (
              <IconButton
                position="absolute"
                {...(pillVertical
                  ? {
                      [direction === "BT" ? "top" : "bottom"]: "-75px",
                      left: "50%",
                      transform: "translateX(-50%)",
                    }
                  : {
                      right: pillOnLeft
                        ? undefined
                        : iconHalfSize === undefined
                          ? "-75px"
                          : `calc(50% - ${iconHalfSize + 75}px)`,
                      left: pillOnLeft
                        ? iconHalfSize === undefined
                          ? "-75px"
                          : `calc(50% - ${iconHalfSize + 75}px)`
                        : undefined,
                      alignSelf:
                        iconHalfSize === undefined ? "center" : undefined,
                      top:
                        iconHalfSize === undefined
                          ? undefined
                          : `${iconHalfSize}px`,
                      transform:
                        iconHalfSize === undefined
                          ? undefined
                          : "translateY(-50%)",
                      zIndex: iconHalfSize === undefined ? undefined : 1,
                    })}
                data-flow-collapse-control=""
                aria-label={nodeData.config.collapsed ? "Expand" : "Collapse"}
                disabled={config.readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  callbacks.onNodeCollapse?.(id, !nodeData.config.collapsed);
                }}
                bgColor={getChakraColorHex(
                  nodeData?.viewProps?.bgColor || themeColor,
                )}
                size="md"
                color="gray.100"
                rounded="full"
                mr={2}
                px={2}
                py={4}
              >
                {nodeData.config.collapsed ? (
                  <PiPlusBold size={30} color={getChakraColorHex("gray.800")} />
                ) : (
                  <PiMinusBold
                    size={30}
                    color={getChakraColorHex("gray.800")}
                  />
                )}
              </IconButton>
            );
          })()}
        {children({
          id,
          data: nodeData,
          isActive,
          isLowZoom,
          isEditing,
          onEditStart: () => setIsEditing(true),
          onEditEnd: () => setIsEditing(false),
        })}
      </Box>
    </Box>
  );
};

export default memo(NodeView);
