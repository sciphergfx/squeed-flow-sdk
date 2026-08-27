import { Box, HStack, IconButton } from "@chakra-ui/react";
import { memo, useCallback, useRef, useState } from "react";
import { PiMinusBold, PiPlusBold } from "react-icons/pi";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import TooltipIconButton from "../components/TooltipIconButton";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";

interface NodeViewProps {
  data: any;
  isInverted?: boolean;
  isParent?: boolean;
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
}: NodeViewProps) => {
  const {
    selectedNodeIds,
    setSelectedNodeIds,
    isMultiSelectMode,
    isPerformanceMode,
    cyRef,
    callbacks,
    config,
    themeColor,
    direction,
  } = useFlowDiagramContext();
  const { background, border, colorText } = useCustomColors();
  const nodeRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const id = nodeData?.id;
  const isActive = selectedNodeIds.includes(id);
  const overlayActions = config.nodeOverlayActions;
  const renderNodeOverlay = config.renderNodeOverlay;

  const isLowZoom = (() => {
    try {
      const zoom = cyRef.current?.zoom();
      return zoom !== undefined && zoom < 0.08;
    } catch {
      return false;
    }
  })();

  const handleClick = useCallback(() => {
    if (isEditing) return;
    if (isMultiSelectMode) {
      const isAlreadySelected = selectedNodeIds.includes(id);
      const newIds = isAlreadySelected
        ? selectedNodeIds.filter((nid) => nid !== id)
        : [...selectedNodeIds, id];
      setSelectedNodeIds(newIds);
      if (isAlreadySelected) {
        callbacks.onNodeDeselect?.();
      } else {
        callbacks.onNodeSelect?.(id, nodeData);
      }
    } else {
      setSelectedNodeIds([id]);
      callbacks.onNodeSelect?.(id, nodeData);
    }
  }, [
    id,
    nodeData,
    selectedNodeIds,
    isMultiSelectMode,
    isEditing,
    setSelectedNodeIds,
    callbacks,
  ]);

  const handleDoubleClick = useCallback(() => {
    if (isEditing) return;
    callbacks.onNodeDoubleClick?.(id, nodeData);
  }, [id, nodeData, isEditing, callbacks]);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 100);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  }, []);

  if (isParent) {
    return (
      <Box
        ref={nodeRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        cursor="pointer"
        position="relative"
      >
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
                  top={"-100px"}
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
                  top={"-100px"}
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
        {nodeData?.config?.collapsed !== undefined &&
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
                aria-label={nodeData.config.collapsed ? "Expand" : "Collapse"}
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
                  <PiPlusBold size={30} color="gray.800" />
                ) : (
                  <PiMinusBold size={30} color="gray.800" />
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
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      cursor="pointer"
      transition="transform 0.1s ease"
      position="relative"
    >
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
                top={"-100px"}
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
                top={"-100px"}
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
        {nodeData?.config?.collapsed !== undefined &&
          !isParent &&
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
                      alignSelf: "center",
                    })}
                aria-label={nodeData.config.collapsed ? "Expand" : "Collapse"}
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
                  <PiPlusBold size={30} color="gray.800" />
                ) : (
                  <PiMinusBold size={30} color="gray.800" />
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
