import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Box, Flex, HStack, Icon, IconButton, Text, Tooltip } from "@chakra-ui/react";
import {
  PiArrowUpLight,
  PiArrowDownLight,
  PiArrowArcRightLight,
  PiArrowArcLeftLight,
  PiLineVerticalThin,
  PiLineVerticalBold,
  PiPushPin,
  PiPushPinFill,
  PiCaretUp,
  PiCaretLeft,
  PiCaretRight,
  PiHandGrabbing,
  PiPencilSimpleLine,
} from "react-icons/pi";
import { HiMinus } from "react-icons/hi2";
import { GrPowerReset } from "react-icons/gr";
import { VscAdd, VscMove, VscZoomIn, VscGroupByRefType } from "react-icons/vsc";
import { TbAlignCenter } from "react-icons/tb";
import { IoCheckmark } from "react-icons/io5";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { useCustomColors, useThemeContentColors } from "../theme/useCustomColors";
import type { FlowDirection } from "../types";
import { FlowType } from "../types";

const DIRECTIONS: { value: FlowDirection; label: string; icon: any; flowType: string }[] = [
  { value: "BT", label: "Bottom to Up", icon: PiArrowUpLight, flowType: FlowType.BOTTOM_UP },
  { value: "TB", label: "Top to Bottom", icon: PiArrowDownLight, flowType: FlowType.TOP_DOWN },
  { value: "LR", label: "Left to Right", icon: PiArrowArcRightLight, flowType: FlowType.LEFT_RIGHT },
  { value: "RL", label: "Right to Left", icon: PiArrowArcLeftLight, flowType: FlowType.RIGHT_LEFT },
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
  } = useFlowDiagramContext();

  const isDark = config.colorMode === "dark";
  const { background, border, colorInactive, colorText, colorActive, darkBackgroundSecondary } = useCustomColors();
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

  const visible = showToolbar || isHoveringIndicator;

  const renderSelectedNodeToolbar = config.renderSelectedNodeToolbar;
  const hasNodeSelection = selectedNodeIds.length > 0 && !!renderSelectedNodeToolbar;

  const selectedNodeData = useMemo(() => {
    if (!hasNodeSelection) return [];
    const cy = cyRef.current;
    if (!cy) return [];
    return selectedNodeIds.map((nid) => {
      const ele = cy.getElementById(nid);
      if (!ele?.length) return { id: nid };
      return { ...ele.data(), isParent: ele.isParent() };
    });
  }, [hasNodeSelection, selectedNodeIds, cyRef]);

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

  const customRenderBottomBar = config.renderBottomBar;

  if (customRenderBottomBar) {
    return (
      <>
        {hasNodeSelection && (
          <Box position="absolute" bottom={5} left="50%" transform="translateX(-50%)" zIndex={101}>
            {renderSelectedNodeToolbar!({
              selectedNodeIds,
              selectedNodeData,
              onDeselect: handleNodeDeselect,
            })}
          </Box>
        )}

        {hasEdgeSelection && selectedEdgeData && (
          <Box position="absolute" bottom={5} left="50%" transform="translateX(-50%)" zIndex={101}>
            {renderSelectedEdgeToolbar!({
              edgeId: selectedEdgeId!,
              edgeData: selectedEdgeData,
              onDeselect: handleEdgeDeselect,
            })}
          </Box>
        )}

        <Box position="absolute" bottom={0} left={0} right={0} zIndex={100} w="100%">
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
        <Box position="absolute" bottom={5} left="50%" transform="translateX(-50%)" zIndex={101}>
          {renderSelectedNodeToolbar!({
            selectedNodeIds,
            selectedNodeData,
            onDeselect: handleNodeDeselect,
          })}
        </Box>
      )}

      {hasEdgeSelection && selectedEdgeData && (
        <Box position="absolute" bottom={5} left="50%" transform="translateX(-50%)" zIndex={101}>
          {renderSelectedEdgeToolbar!({
            edgeId: selectedEdgeId!,
            edgeData: selectedEdgeData,
            onDeselect: handleEdgeDeselect,
          })}
        </Box>
      )}

      {!isPinned && (
        <Box position="absolute" bottom={5} left={0} zIndex={101} w={3}>
          <Tooltip label="Show Bottom Bar" placement="top" fontSize="xs">
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
              <Icon ml={-1} as={PiLineVerticalBold} boxSize={5} color={border} />
            </Flex>
          </Tooltip>
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
        <Flex w="100%" px={5} position="absolute" bottom={5} flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box bg={background} alignContent="center" h={50} borderColor={border} borderWidth={1} borderRadius="15px">
            <HStack px={2} spacing={1}>
              {/* Pin/Unpin */}
              <Tooltip label={isPinned ? "Unpin" : "Pin"} placement="top" fontSize="xs">
                <IconButton
                  aria-label="Pin"
                  icon={<Icon as={isPinned ? PiPushPinFill : PiPushPin} boxSize={5} />}
                  size="sm"
                  variant="ghost"
                  color={isPinned ? themeColor : colorInactive}
                  onClick={() => {
                    const next = !isPinned;
                    setIsPinned(next);
                    setShowToolbar(next);
                  }}
                />
              </Tooltip>

              <Icon mx={-1} as={PiLineVerticalThin} boxSize={5} color={border} />

              {/* Zoom controls */}
              <Tooltip label="Zoom Out" placement="top" fontSize="xs">
                <IconButton aria-label="Zoom out" icon={<Icon as={HiMinus} boxSize={5} />} size="sm" variant="ghost" color={colorText} onClick={() => handleZoom("decrease")} />
              </Tooltip>
              <Tooltip label="Zoom In" placement="top" fontSize="xs">
                <IconButton aria-label="Zoom in" icon={<Icon as={VscAdd} boxSize={5} />} size="sm" variant="ghost" color={colorText} onClick={() => handleZoom("increase")} />
              </Tooltip>
              <Tooltip label="Reset Zoom" placement="top" fontSize="xs">
                <IconButton aria-label="Reset zoom" icon={<Icon as={GrPowerReset} boxSize={5} />} size="sm" variant="ghost" color={colorText} onClick={() => handleZoom("reset")} />
              </Tooltip>
              {!isCollapsed && (
                <>
                  <Icon mx={-1} as={PiLineVerticalThin} boxSize={5} color={border} />

                  {/* Zoom/Pan mode */}
                  <Tooltip label={isZoomMode ? "Zoom Mode (z)" : "Pan Mode (z)"} placement="top" fontSize="xs">
                    <IconButton
                      aria-label="Toggle zoom mode"
                      icon={<Icon as={isZoomMode ? VscZoomIn : VscMove} boxSize={5} />}
                      size="sm"
                      variant="ghost"
                      color={isZoomMode ? themeColor : colorInactive}
                      onClick={() => setIsZoomMode(!isZoomMode)}
                    />
                  </Tooltip>

                  <Icon mx={-1} as={PiLineVerticalThin} boxSize={5} color={border} />

                  {/* Multi-select */}
                  <Tooltip label={isMultiSelectMode ? "Multi-Select On (m)" : "Multi-Select Off (m)"} placement="top" fontSize="xs">
                    <IconButton
                      aria-label="Toggle multi-select"
                      icon={<Icon as={VscGroupByRefType} boxSize={5} />}
                      size="sm"
                      variant="ghost"
                      color={isMultiSelectMode ? themeColor : colorInactive}
                      onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                    />
                  </Tooltip>

                  <Icon mx={-1} as={PiLineVerticalThin} boxSize={5} color={border} />

                  {/* Drag mode */}
                  <Tooltip label={isDragMode ? "Drag Mode On (d)" : "Drag Mode Off (d)"} placement="top" fontSize="xs">
                    <IconButton
                      aria-label="Toggle drag mode"
                      icon={<Icon as={PiHandGrabbing} boxSize={5} />}
                      size="sm"
                      variant="ghost"
                      color={isDragMode ? themeColor : colorInactive}
                      onClick={() => setIsDragMode(!isDragMode)}
                    />
                  </Tooltip>

                  {config.edgeHandles !== false && (
                    <>
                      <Icon mx={-1} as={PiLineVerticalThin} boxSize={5} color={border} />
                      <Tooltip label={isEdgeHandlesEnabled ? "Draw Mode On" : "Draw Mode Off"} placement="top" fontSize="xs">
                        <IconButton
                          aria-label="Toggle draw mode"
                          icon={<Icon as={PiPencilSimpleLine} boxSize={5} />}
                          size="sm"
                          variant="ghost"
                          color={isEdgeHandlesEnabled ? themeColor : colorInactive}
                          onClick={() => setIsEdgeHandlesEnabled(!isEdgeHandlesEnabled)}
                        />
                      </Tooltip>
                    </>
                  )}

                  <Icon mx={-1} as={PiLineVerticalThin} boxSize={5} color={border} />

                  <Tooltip label={isArrayNodeMode ? "List mode" : "Set mode"} placement="top" fontSize="xs">
                    <Flex
                      cursor="pointer"
                      align="center"
                      onClick={() => {
                        const next = !isArrayNodeMode;
                        setIsArrayNodeMode(next);
                        callbacks.onArrayModeChange?.(next);
                      }}
                      _hover={{ color: themeColor }}
                    >
                      <Text fontSize="23px" color={isArrayNodeMode ? themeColor : colorInactive}>
                        {isArrayNodeMode ? "[]" : "{}"}
                      </Text>
                    </Flex>
                  </Tooltip>
                </>
              )}

              <Icon mx={-1} as={PiLineVerticalThin} boxSize={5} color={border} />

              <Tooltip label={isCollapsed ? "Expand toolbar" : "Collapse toolbar"} placement="top" fontSize="xs">
                <IconButton
                  aria-label="Toggle toolbar collapse"
                  icon={<Icon as={isCollapsed ? PiCaretRight : PiCaretLeft} boxSize={5} />}
                  size="sm"
                  variant="ghost"
                  color={colorInactive}
                  onClick={() => setIsCollapsed(!isCollapsed)}
                />
              </Tooltip>
            </HStack>
          </Box>

          {/* Direction picker */}
          <Box position="relative" ml="auto">
            <Box bg={background} borderWidth={1} borderColor={border} borderRadius="15px" h={50} px={3} cursor="pointer" onClick={() => setShowDirectionMenu(!showDirectionMenu)}>
              <Flex align="center" h="100%">
                <Tooltip label="Flow Direction" placement="top" fontSize="xs">
                  <IconButton
                    aria-label="Direction"
                    icon={<Icon as={PiCaretUp} boxSize={4} />}
                    size="sm"
                    variant="ghost"
                    color={colorInactive}
                  />
                </Tooltip>
                <Text fontSize="xs" color={isDark ? "whiteAlpha.600" : "blackAlpha.500"} ml={1}>
                  {direction}
                </Text>
              </Flex>
            </Box>

            {showDirectionMenu && (
              <Box
                position="absolute"
                bottom="60px"
                right={0}
                bg={background}
                borderWidth={1}
                borderColor={border}
                borderRadius="15px"
                p={2}
                zIndex={200}
                minW="180px"
                shadow="lg"
                onMouseLeave={() => setShowDirectionMenu(false)}
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
                    _hover={{ bg: isDark ? "whiteAlpha.100" : "blackAlpha.50" }}
                    onClick={() => {
                      callbacks.onDirectionChange?.(d.value);
                      setShowDirectionMenu(false);
                    }}
                  >
                    <Icon as={d.icon} boxSize={5} color={colorText} />
                    <Text fontSize="sm" color={colorText} flex={1} whiteSpace="nowrap">
                      {d.label}
                    </Text>
                    {direction === d.value && <Icon as={IoCheckmark} boxSize={4} color={colorActive} />}
                  </Flex>
                ))}
                <Flex
                  align="center"
                  gap={3}
                  px={3}
                  py={2}
                  borderRadius="10px"
                  cursor="pointer"
                  _hover={{ bg: isDark ? "whiteAlpha.100" : "blackAlpha.50" }}
                  onClick={() => {
                    callbacks.onDirectionChange?.("LR" as FlowDirection);
                    setShowDirectionMenu(false);
                  }}
                >
                  <Icon as={TbAlignCenter} boxSize={5} color={colorText} />
                  <Text fontSize="sm" color={colorText} flex={1} whiteSpace="nowrap">
                    Center
                  </Text>
                  {(direction as string) === "C" && <Icon as={IoCheckmark} boxSize={4} color={colorActive} />}
                </Flex>
              </Box>
            )}
          </Box>
        </Flex>
      </Box>
    </>
  );
};

BottomBar.displayName = "BottomBar";
export default memo(BottomBar);
