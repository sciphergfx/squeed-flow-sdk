import { Box, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  PiAlignCenterHorizontal,
  PiArrowCounterClockwise,
  PiArrowDown,
  PiArrowLeft,
  PiArrowRight,
  PiArrowUp,
  PiArrowsOutCardinal,
  PiBracketsCurly,
  PiBracketsSquare,
  PiCaretLeft,
  PiCaretRight,
  PiCaretUp,
  PiCheck,
  PiHandGrabbing,
  PiLineVerticalBold,
  PiLineVerticalThin,
  PiMagnifyingGlassPlus,
  PiMinus,
  PiPencilSimpleLine,
  PiPlus,
  PiPushPin,
  PiPushPinFill,
  PiSelectionPlus,
} from "react-icons/pi";
import { useCustomColors } from "../theme/useCustomColors";
import type { FlowDirection } from "../types";
import { FlowType } from "../types";
import { useFlowData, useFlowDiagramContext } from "./FlowDiagramContext";
import { EdgeTools, NodeTools } from "./SelectionToolbar";
import { ToolbarIconButton, ToolbarTooltip } from "./toolbarControls";

const DIRECTIONS: {
  value: FlowDirection;
  label: string;
  icon: any;
  flowType: string;
}[] = [
  {
    value: "BT",
    label: "Bottom to Up",
    icon: PiArrowUp,
    flowType: FlowType.BOTTOM_UP,
  },
  {
    value: "TB",
    label: "Top to Bottom",
    icon: PiArrowDown,
    flowType: FlowType.TOP_DOWN,
  },
  {
    value: "LR",
    label: "Left to Right",
    icon: PiArrowRight,
    flowType: FlowType.LEFT_RIGHT,
  },
  {
    value: "RL",
    label: "Right to Left",
    icon: PiArrowLeft,
    flowType: FlowType.RIGHT_LEFT,
  },
];

const BottomBar = () => {
  const {
    cyRef,
    themeColor,
    direction,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    isZoomMode,
    setIsZoomMode,
    isMultiSelectMode,
    setIsMultiSelectMode,
    isDragMode,
    setIsDragMode,
    isEdgeHandlesEnabled,
    setIsEdgeHandlesEnabled,
    isArrayNodeMode,
    setIsArrayNodeMode,
    isPinned,
    setIsPinned,
    callbacks,
    config,
    readOnly,
  } = useFlowDiagramContext();
  const { nodeById } = useFlowData();

  const isDark = config.colorMode === "dark";
  const {
    background,
    border,
    colorInactive,
    colorText,
    colorActive,
    darkBackgroundSecondary,
  } = useCustomColors();
  const [showToolbar, setShowToolbar] = useState(true);
  const [isHoveringIndicator, setIsHoveringIndicator] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [showDirectionMenu, setShowDirectionMenu] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    const checkDevice = () => setIsDesktop(window.innerWidth >= 768);
    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setShowToolbar(true);
      return;
    }
    if (!isPinned) {
      setShowToolbar(false);
      return;
    }
    const handleMouseMove = (e: MouseEvent) => {
      setShowToolbar(window.innerHeight - e.clientY <= 250);
    };
    const handleMouseLeave = () => setShowToolbar(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isDesktop, isPinned]);

  const handleZoom = useCallback(
    (action: "increase" | "decrease" | "reset") => {
      const cy = cyRef.current;
      if (!cy) return;

      const minZoom = config.minZoom ?? 0.01;
      const maxZoom = config.maxZoom ?? 1.5;
      const zoomStep = 0.02;

      const prevZooming = cy.zoomingEnabled();
      const prevUserZooming = cy.userZoomingEnabled();
      cy.zoomingEnabled(true);
      cy.userZoomingEnabled(true);

      let zoom = cy.zoom();
      switch (action) {
        case "increase":
          zoom = Math.min(maxZoom, zoom + zoomStep);
          cy.zoom(zoom);
          cy.center();
          break;
        case "decrease":
          zoom = Math.max(minZoom, zoom - zoomStep);
          cy.zoom(zoom);
          cy.center();
          break;
        case "reset":
          cy.fit(undefined, 50);
          break;
      }

      cy.zoomingEnabled(prevZooming);
      cy.userZoomingEnabled(prevUserZooming);
    },
    [cyRef, config.minZoom, config.maxZoom],
  );

  const renderSelectedNodeToolbar = config.renderSelectedNodeToolbar;
  const hasNodeSelection =
    selectedNodeIds.length > 0 && !!renderSelectedNodeToolbar;

  const selectedNodeData = useMemo(() => {
    if (!hasNodeSelection) return [];
    const cy = cyRef.current;
    return selectedNodeIds.map((nid) => {
      const ele = cy?.getElementById(nid);
      const base =
        nodeById.get(nid)?.data ?? (ele?.length ? ele.data() : { id: nid });
      return { ...base, isParent: !!ele?.length && ele.isParent() };
    });
  }, [hasNodeSelection, selectedNodeIds, cyRef, nodeById]);

  const handleNodeDeselect = useCallback(() => {
    setSelectedNodeIds([]);
    callbacks.onNodeDeselect?.();
  }, [setSelectedNodeIds, callbacks]);

  const renderSelectedEdgeToolbar = config.renderSelectedEdgeToolbar;
  const hasEdgeSelection = !!selectedEdgeId && !!renderSelectedEdgeToolbar;

  const selectedEdgeData = useMemo(() => {
    if (!hasEdgeSelection || !selectedEdgeId) return null;
    const cy = cyRef.current;
    if (!cy) return { id: selectedEdgeId };
    const ele = cy.getElementById(selectedEdgeId);
    return ele?.length ? ele.data() : { id: selectedEdgeId };
  }, [hasEdgeSelection, selectedEdgeId, cyRef]);

  const handleEdgeDeselect = useCallback(() => {
    setSelectedEdgeId(null);
    const cy = cyRef.current;
    if (cy) cy.edges().unselect();
    callbacks.onEdgeDeselect?.();
  }, [setSelectedEdgeId, cyRef, callbacks]);

  // Built-in selection tools replace the left tool group ([x] label | style | color | ...)
  const builtInSelection = config.selectionToolbar !== false && !readOnly;
  const edgeToolsActive =
    builtInSelection && !!selectedEdgeId && !renderSelectedEdgeToolbar;
  const nodeToolsActive =
    builtInSelection &&
    !edgeToolsActive &&
    selectedNodeIds.length > 0 &&
    !renderSelectedNodeToolbar;
  const selectionActive = edgeToolsActive || nodeToolsActive;

  // Open menu / active selection extend beyond the 250px auto-hide threshold; keep bar mounted
  const visible =
    showToolbar || isHoveringIndicator || showDirectionMenu || selectionActive;

  const customRenderBottomBar = config.renderBottomBar;

  if (customRenderBottomBar) {
    return (
      <>
        {hasNodeSelection && (
          <Box
            position="absolute"
            bottom={5}
            left="50%"
            transform="translateX(-50%)"
            zIndex={101}
          >
            {renderSelectedNodeToolbar!({
              selectedNodeIds,
              selectedNodeData,
              onDeselect: handleNodeDeselect,
            })}
          </Box>
        )}

        {hasEdgeSelection && selectedEdgeData && (
          <Box
            position="absolute"
            bottom={5}
            left="50%"
            transform="translateX(-50%)"
            zIndex={101}
          >
            {renderSelectedEdgeToolbar!({
              edgeId: selectedEdgeId!,
              edgeData: selectedEdgeData,
              onDeselect: handleEdgeDeselect,
            })}
          </Box>
        )}

        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          zIndex={100}
          w="100%"
        >
          {customRenderBottomBar({
            zoomIn: () => handleZoom("increase"),
            zoomOut: () => handleZoom("decrease"),
            resetZoom: () => handleZoom("reset"),
            direction: direction as any,
            isZoomMode,
            setIsZoomMode,
            isMultiSelectMode,
            setIsMultiSelectMode,
            isDragMode,
            setIsDragMode,
            isEdgeHandlesEnabled,
            setIsEdgeHandlesEnabled,
            isArrayNodeMode,
            setIsArrayNodeMode,
            selectedNodeIds,
            selectedNodeData,
            selectedEdgeId,
            selectedEdgeData,
            onNodeDeselect: handleNodeDeselect,
            onEdgeDeselect: handleEdgeDeselect,
            callbacks,
          })}
        </Box>
      </>
    );
  }

  return (
    <>
      {hasNodeSelection && (
        <Box
          position="absolute"
          bottom={5}
          left="50%"
          transform="translateX(-50%)"
          zIndex={101}
        >
          {renderSelectedNodeToolbar!({
            selectedNodeIds,
            selectedNodeData,
            onDeselect: handleNodeDeselect,
          })}
        </Box>
      )}

      {hasEdgeSelection && selectedEdgeData && (
        <Box
          position="absolute"
          bottom={5}
          left="50%"
          transform="translateX(-50%)"
          zIndex={101}
        >
          {renderSelectedEdgeToolbar!({
            edgeId: selectedEdgeId!,
            edgeData: selectedEdgeData,
            onDeselect: handleEdgeDeselect,
          })}
        </Box>
      )}

      {!isPinned && (
        <Box position="absolute" bottom={5} left={0} zIndex={101} w={3}>
          <ToolbarTooltip label="Show Bottom Bar">
            <Flex
              align="center"
              bg={background}
              borderColor={border}
              borderWidth={1}
              py={6}
              px={0}
              w={4}
              h={50}
              borderRadius="15px"
              borderLeftRadius={0}
              onMouseEnter={() => {
                setIsHoveringIndicator(true);
                setShowToolbar(true);
              }}
              onMouseLeave={() => setIsHoveringIndicator(false)}
              _hover={{ bg: darkBackgroundSecondary }}
            >
              <Icon
                ml={-1}
                as={PiLineVerticalBold}
                boxSize={5}
                color={border}
              />
            </Flex>
          </ToolbarTooltip>
        </Box>
      )}

      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        zIndex={100}
        w="100%"
        transition="opacity 0.3s ease-in, transform 0.3s ease"
        transform={visible ? "translateY(0)" : "translateY(100%)"}
        pointerEvents={visible ? "auto" : "none"}
        opacity={visible ? 1 : 0}
        onMouseEnter={() => {
          if (!isPinned) setShowToolbar(true);
        }}
        onMouseLeave={() => {
          if (!isPinned) {
            setShowToolbar(false);
            setIsHoveringIndicator(false);
          }
        }}
      >
        <Flex
          w="100%"
          px={5}
          position="absolute"
          bottom={5}
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box
            bg={background}
            alignContent="center"
            h={50}
            borderColor={border}
            borderWidth={1}
            borderRadius="15px"
          >
            <HStack px={2} gap={1}>
              {edgeToolsActive ? (
                <EdgeTools
                  edgeId={selectedEdgeId!}
                  onClose={handleEdgeDeselect}
                />
              ) : nodeToolsActive ? (
                <NodeTools ids={selectedNodeIds} onClose={handleNodeDeselect} />
              ) : (
                <>
                  {/* Pin/Unpin */}
                  <ToolbarTooltip label={isPinned ? "Unpin" : "Pin"}>
                    <ToolbarIconButton
                      aria-label="Pin"
                      icon={
                        <Icon
                          as={isPinned ? PiPushPinFill : PiPushPin}
                          boxSize={5}
                        />
                      }
                      size="sm"
                      variant="ghost"
                      color={isPinned ? themeColor : colorInactive}
                      onClick={() => {
                        const next = !isPinned;
                        setIsPinned(next);
                        setShowToolbar(next);
                      }}
                    />
                  </ToolbarTooltip>

                  <Icon
                    mx={-1}
                    as={PiLineVerticalThin}
                    boxSize={5}
                    color={border}
                  />

                  {/* Zoom controls */}
                  <ToolbarTooltip label="Zoom Out">
                    <ToolbarIconButton
                      aria-label="Zoom out"
                      icon={<Icon as={PiMinus} boxSize={5} />}
                      size="sm"
                      variant="ghost"
                      color={colorText}
                      onClick={() => handleZoom("decrease")}
                    />
                  </ToolbarTooltip>
                  <ToolbarTooltip label="Zoom In">
                    <ToolbarIconButton
                      aria-label="Zoom in"
                      icon={<Icon as={PiPlus} boxSize={5} />}
                      size="sm"
                      variant="ghost"
                      color={colorText}
                      onClick={() => handleZoom("increase")}
                    />
                  </ToolbarTooltip>
                  <ToolbarTooltip label="Reset Zoom">
                    <ToolbarIconButton
                      aria-label="Reset zoom"
                      icon={<Icon as={PiArrowCounterClockwise} boxSize={5} />}
                      size="sm"
                      variant="ghost"
                      color={colorText}
                      onClick={() => handleZoom("reset")}
                    />
                  </ToolbarTooltip>
                  {!isCollapsed && (
                    <>
                      <Icon
                        mx={-1}
                        as={PiLineVerticalThin}
                        boxSize={5}
                        color={border}
                      />

                      {/* Zoom/Pan mode */}
                      <ToolbarTooltip
                        label={isZoomMode ? "Zoom Mode (z)" : "Pan Mode (z)"}
                      >
                        <ToolbarIconButton
                          aria-label="Toggle zoom mode"
                          icon={
                            <Icon
                              as={
                                isZoomMode
                                  ? PiMagnifyingGlassPlus
                                  : PiArrowsOutCardinal
                              }
                              boxSize={5}
                            />
                          }
                          size="sm"
                          variant="ghost"
                          color={isZoomMode ? themeColor : colorInactive}
                          onClick={() => setIsZoomMode(!isZoomMode)}
                        />
                      </ToolbarTooltip>

                      <Icon
                        mx={-1}
                        as={PiLineVerticalThin}
                        boxSize={5}
                        color={border}
                      />

                      {/* Multi-select */}
                      <ToolbarTooltip
                        label={
                          isMultiSelectMode
                            ? "Multi-Select On (m)"
                            : "Multi-Select Off (m)"
                        }
                      >
                        <ToolbarIconButton
                          aria-label="Toggle multi-select"
                          icon={<Icon as={PiSelectionPlus} boxSize={5} />}
                          size="sm"
                          variant="ghost"
                          color={isMultiSelectMode ? themeColor : colorInactive}
                          onClick={() =>
                            setIsMultiSelectMode(!isMultiSelectMode)
                          }
                        />
                      </ToolbarTooltip>

                      <Icon
                        mx={-1}
                        as={PiLineVerticalThin}
                        boxSize={5}
                        color={border}
                      />

                      {/* Drag mode */}
                      <ToolbarTooltip
                        label={
                          isDragMode ? "Drag Mode On (d)" : "Drag Mode Off (d)"
                        }
                      >
                        <ToolbarIconButton
                          aria-label="Toggle drag mode"
                          icon={<Icon as={PiHandGrabbing} boxSize={5} />}
                          size="sm"
                          variant="ghost"
                          color={isDragMode ? themeColor : colorInactive}
                          onClick={() => setIsDragMode(!isDragMode)}
                        />
                      </ToolbarTooltip>

                      {config.edgeHandles !== false && (
                        <>
                          <Icon
                            mx={-1}
                            as={PiLineVerticalThin}
                            boxSize={5}
                            color={border}
                          />

                          {/* Draw mode */}
                          <ToolbarTooltip
                            label={
                              isEdgeHandlesEnabled
                                ? "Draw Mode On"
                                : "Draw Mode Off"
                            }
                          >
                            <ToolbarIconButton
                              aria-label="Toggle draw mode"
                              icon={
                                <Icon as={PiPencilSimpleLine} boxSize={5} />
                              }
                              size="sm"
                              variant="ghost"
                              color={
                                isEdgeHandlesEnabled
                                  ? themeColor
                                  : colorInactive
                              }
                              onClick={() =>
                                setIsEdgeHandlesEnabled(!isEdgeHandlesEnabled)
                              }
                            />
                          </ToolbarTooltip>
                        </>
                      )}

                      <Icon
                        mx={-1}
                        as={PiLineVerticalThin}
                        boxSize={5}
                        color={border}
                      />

                      {/* Set / Array node mode */}
                      <ToolbarTooltip
                        label={
                          isArrayNodeMode ? "Array Mode [ ]" : "Set Mode { }"
                        }
                      >
                        <ToolbarIconButton
                          aria-label="Toggle array mode"
                          icon={
                            <Icon
                              as={
                                isArrayNodeMode
                                  ? PiBracketsSquare
                                  : PiBracketsCurly
                              }
                              boxSize={5}
                            />
                          }
                          size="sm"
                          variant="ghost"
                          color={isArrayNodeMode ? themeColor : colorInactive}
                          onClick={() => {
                            const next = !isArrayNodeMode;
                            setIsArrayNodeMode(next);
                            callbacks.onArrayModeChange?.(next);
                          }}
                        />
                      </ToolbarTooltip>
                    </>
                  )}

                  <Icon
                    mx={-1}
                    as={PiLineVerticalThin}
                    boxSize={5}
                    color={border}
                  />

                  <ToolbarTooltip
                    label={isCollapsed ? "Expand toolbar" : "Collapse toolbar"}
                  >
                    <ToolbarIconButton
                      aria-label="Toggle toolbar collapse"
                      icon={
                        <Icon
                          as={isCollapsed ? PiCaretRight : PiCaretLeft}
                          boxSize={5}
                        />
                      }
                      size="sm"
                      variant="ghost"
                      color={colorInactive}
                      onClick={() => setIsCollapsed(!isCollapsed)}
                    />
                  </ToolbarTooltip>
                </>
              )}
            </HStack>
          </Box>

          {/* Direction picker */}
          {!selectionActive && (
            <Box
              position="relative"
              ml="auto"
              onMouseLeave={() => setShowDirectionMenu(false)}
            >
              <Box
                bg={background}
                borderWidth={1}
                borderColor={border}
                borderRadius="15px"
                h={50}
                px={3}
                cursor="pointer"
                onClick={() => setShowDirectionMenu(!showDirectionMenu)}
              >
                <Flex align="center" h="100%">
                  <ToolbarTooltip label="Flow Direction">
                    <ToolbarIconButton
                      aria-label="Direction"
                      icon={<Icon as={PiCaretUp} boxSize={5} />}
                      size="sm"
                      variant="ghost"
                      color={colorInactive}
                    />
                  </ToolbarTooltip>
                  <Text
                    fontSize="xs"
                    color={isDark ? "whiteAlpha.600" : "blackAlpha.500"}
                    ml={1}
                  >
                    {direction}
                  </Text>
                </Flex>
              </Box>

              {showDirectionMenu && (
                // pb bridges the gap so the pointer never leaves the wrapper
                <Box
                  position="absolute"
                  bottom="100%"
                  right={0}
                  pb="10px"
                  zIndex={200}
                >
                  <Box
                    bg={background}
                    borderWidth={1}
                    borderColor={border}
                    borderRadius="15px"
                    p={2}
                    minW="180px"
                    shadow="lg"
                  >
                    {DIRECTIONS.map((d) => (
                      <Flex
                        key={d.value}
                        align="center"
                        gap={3}
                        px={3}
                        py={2}
                        borderRadius="10px"
                        cursor="pointer"
                        _hover={{
                          bg: isDark ? "whiteAlpha.100" : "blackAlpha.50",
                        }}
                        onClick={() => {
                          callbacks.onDirectionChange?.(d.value);
                          setShowDirectionMenu(false);
                        }}
                      >
                        <Icon as={d.icon} boxSize={5} color={colorText} />
                        <Text
                          fontSize="sm"
                          color={colorText}
                          flex={1}
                          whiteSpace="nowrap"
                        >
                          {d.label}
                        </Text>
                        {direction === d.value && (
                          <Icon as={PiCheck} boxSize={4} color={colorActive} />
                        )}
                      </Flex>
                    ))}
                    <Flex
                      align="center"
                      gap={3}
                      px={3}
                      py={2}
                      borderRadius="10px"
                      cursor="pointer"
                      _hover={{
                        bg: isDark ? "whiteAlpha.100" : "blackAlpha.50",
                      }}
                      onClick={() => {
                        callbacks.onDirectionChange?.("C");
                        setShowDirectionMenu(false);
                      }}
                    >
                      <Icon
                        as={PiAlignCenterHorizontal}
                        boxSize={5}
                        color={colorText}
                      />
                      <Text
                        fontSize="sm"
                        color={colorText}
                        flex={1}
                        whiteSpace="nowrap"
                      >
                        Center
                      </Text>
                      {direction === "C" && (
                        <Icon as={PiCheck} boxSize={4} color={colorActive} />
                      )}
                    </Flex>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Flex>
      </Box>
    </>
  );
};

BottomBar.displayName = "BottomBar";
export default memo(BottomBar);
