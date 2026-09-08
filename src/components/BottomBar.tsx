import { Box, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PiAlignCenterHorizontal,
  PiArrowCounterClockwise,
  PiArrowDown,
  PiArrowLeft,
  PiArrowRight,
  PiArrowsInLineVertical,
  PiArrowsOutCardinal,
  PiArrowUp,
  PiBracketsCurly,
  PiBracketsSquare,
  PiCaretLeft,
  PiCaretRight,
  PiCaretUp,
  PiCheck,
  PiHandGrabbing,
  PiLineVerticalThin,
  PiMagnifyingGlassPlus,
  PiMinus,
  PiPencilSimpleLine,
  PiPlus,
  PiPushPin,
  PiPushPinFill,
  PiSelectionPlus,
} from "react-icons/pi";
import { useEdgeProximity } from "../hooks/useEdgeProximity";
import { LIGHT_BLACK } from "../theme/colorUtils";
import { getInteractionSurface } from "../theme/interactionShadow";
import { useCustomColors } from "../theme/useCustomColors";
import type { FlowDirection } from "../types";
import { FlowType } from "../types";
import { CompactPropertyLayoutToggle } from "./CompactPropertyLayoutToggle";
import { DiagramAppearanceControls } from "./DiagramAppearanceControls";
import { useFlowData, useFlowDiagramContext } from "./FlowDiagramContext";
import { LabeledToolbarToggle } from "./LabeledToolbarToggle";
import {
  DEFAULT_PALETTE,
  EdgeTools,
  NodeTools,
  Swatches,
} from "./SelectionToolbar";
import { SvgExportButton } from "./SvgExportButton";
import {
  menuItemCorners,
  ToolbarIconButton,
  ToolbarTooltip,
} from "./toolbarControls";
import { ToolbarScrollContainer } from "./ToolbarScrollContainer";
import { WorkflowControls } from "./WorkflowControls";

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
    engineRef,
    themeColor,
    setThemeColor,
    edgeColor,
    setEdgeColor,
    backgroundSelected,
    setBackgroundSelected,
    direction,
    edgeMode,
    allNodesIconLabel,
    setAllNodesIconLabel,
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
  const { nodeById, edgeById, parentIds } = useFlowData();

  const isDark = config.colorMode === "dark";
  const { background, border, colorInactive, colorText, colorActive } =
    useCustomColors();
  const dividerColor = isDark ? border : "gray.300";
  const surfaceColor = `var(--chakra-colors-${background.replace(".", "-")})`;
  const borderColor = `var(--chakra-colors-${(isDark ? border : "gray.300").replace(".", "-")})`;
  const [showDirectionMenu, setShowDirectionMenu] = useState(false);
  const [localCollapsed, setLocalCollapsed] = useState(true);
  const isCollapsed = config.bottomBarCollapsed ?? localCollapsed;
  const bar = useRef<HTMLDivElement>(null);
  const nearBottom = useEdgeProximity({
    edge: "bottom",
    enabled: !isPinned,
    bounds: bar,
    inside: [bar],
  });

  const handleZoom = useCallback(
    (action: "increase" | "decrease" | "reset") => {
      const engine = engineRef.current;
      if (!engine) return;

      const minZoom = config.minZoom ?? 0.01;
      const maxZoom = config.maxZoom ?? 1.5;
      const zoomStep = 0.02;

      let zoom = engine.zoom();
      switch (action) {
        case "increase":
          zoom = Math.min(maxZoom, zoom + zoomStep);
          engine.zoom(zoom);
          engine.center();
          break;
        case "decrease":
          zoom = Math.max(minZoom, zoom - zoomStep);
          engine.zoom(zoom);
          engine.center();
          break;
        case "reset":
          engine.fit(50);
          break;
      }
    },
    [engineRef, config.minZoom, config.maxZoom],
  );

  const renderSelectedNodeToolbar = config.renderSelectedNodeToolbar;
  const hasNodeSelection =
    selectedNodeIds.length > 0 && !!renderSelectedNodeToolbar;

  const selectedNodeData = useMemo(() => {
    if (!hasNodeSelection) return [];
    return selectedNodeIds.map((nid) => {
      const base = nodeById.get(nid)?.data ?? { id: nid };
      return { ...base, isParent: parentIds.has(nid) };
    });
  }, [hasNodeSelection, selectedNodeIds, nodeById, parentIds]);

  const handleNodeDeselect = useCallback(() => {
    setSelectedNodeIds([]);
    callbacks.onNodeDeselect?.();
  }, [setSelectedNodeIds, callbacks]);

  const renderSelectedEdgeToolbar = config.renderSelectedEdgeToolbar;
  const hasEdgeSelection = !!selectedEdgeId && !!renderSelectedEdgeToolbar;

  const selectedEdgeData = useMemo(() => {
    if (!hasEdgeSelection || !selectedEdgeId) return null;
    return edgeById.get(selectedEdgeId)?.data ?? { id: selectedEdgeId };
  }, [hasEdgeSelection, selectedEdgeId, edgeById]);

  const handleEdgeDeselect = useCallback(() => {
    setSelectedEdgeId(null);
    callbacks.onEdgeDeselect?.();
  }, [setSelectedEdgeId, callbacks]);

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

  const visible =
    isPinned ||
    nearBottom ||
    showDirectionMenu ||
    selectionActive ||
    config.bottomBarCollapsed === false;

  useEffect(() => {
    if (selectedNodeIds.length || selectedEdgeId) {
      setBackgroundSelected(false);
    } else if (!readOnly) {
      if (backgroundSelected) setIsPinned(true);
      if (config.bottomBarCollapsed === undefined)
        setLocalCollapsed(!backgroundSelected);
    }
  }, [
    backgroundSelected,
    selectedNodeIds.length,
    selectedEdgeId,
    readOnly,
    setBackgroundSelected,
    setIsPinned,
    config.bottomBarCollapsed,
  ]);

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

      <Box
        ref={bar}
        role="toolbar"
        aria-label="Diagram controls"
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        zIndex={100}
        w="100%"
        transition="opacity 0.3s ease-in, transform 0.3s ease"
        transform={visible ? "translateY(0)" : "translateY(100%)"}
        pointerEvents={visible ? "auto" : "none"}
        visibility={visible ? "visible" : "hidden"}
        opacity={visible ? 1 : 0}
        css={{
          "@media (hover: none)": {
            visibility: "visible",
            opacity: 1,
            transform: "none",
            pointerEvents: "auto",
          },
        }}
      >
        <Flex
          w="100%"
          px={5}
          position="absolute"
          bottom="calc(20px + env(safe-area-inset-bottom, 0px))"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          gap="24px"
        >
          <ToolbarScrollContainer
            background={background}
            border={isDark ? border : "gray.300"}
          >
            <HStack
              px={2}
              gap={1}
              flexWrap="nowrap"
              w="max-content"
              minW="100%"
              h="100%"
              css={{ "& > *": { flexShrink: 0 } }}
            >
              {edgeToolsActive ? (
                <EdgeTools
                  edgeId={selectedEdgeId!}
                  onClose={handleEdgeDeselect}
                />
              ) : nodeToolsActive ? (
                <NodeTools ids={selectedNodeIds} onClose={handleNodeDeselect} />
              ) : null}
              <div
                style={{
                  display:
                    edgeToolsActive || nodeToolsActive ? "none" : "contents",
                }}
              >
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
                      setShowDirectionMenu(false);
                    }}
                  />
                </ToolbarTooltip>

                <Icon
                  mx={-1}
                  as={PiLineVerticalThin}
                  boxSize={5}
                  color={dividerColor}
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
                      color={dividerColor}
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
                      color={dividerColor}
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
                        onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                      />
                    </ToolbarTooltip>

                    <Icon
                      mx={-1}
                      as={PiLineVerticalThin}
                      boxSize={5}
                      color={dividerColor}
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
                          color={dividerColor}
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
                            icon={<Icon as={PiPencilSimpleLine} boxSize={5} />}
                            size="sm"
                            variant="ghost"
                            color={
                              isEdgeHandlesEnabled ? themeColor : colorInactive
                            }
                            onClick={() =>
                              setIsEdgeHandlesEnabled(!isEdgeHandlesEnabled)
                            }
                          />
                        </ToolbarTooltip>
                      </>
                    )}

                    {config.bottomBarExtra && (
                      <>
                        <Icon
                          mx={-1}
                          as={PiLineVerticalThin}
                          boxSize={5}
                          color={dividerColor}
                          role="separator"
                          aria-orientation="vertical"
                        />
                        {config.bottomBarExtra}
                      </>
                    )}

                    <Icon
                      mx={-1}
                      as={PiLineVerticalThin}
                      boxSize={5}
                      color={dividerColor}
                      role="separator"
                      aria-orientation="vertical"
                    />
                    <CompactPropertyLayoutToggle />
                    <LabeledToolbarToggle
                      label="Collapse all"
                      checked={allNodesIconLabel}
                      icon={<Icon as={PiArrowsInLineVertical} boxSize={5} />}
                      onChange={setAllNodesIconLabel}
                    />

                    {edgeMode !== "properties" && (
                      <>
                        <Icon
                          mx={-1}
                          as={PiLineVerticalThin}
                          boxSize={5}
                          color={dividerColor}
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
                    {backgroundSelected && !readOnly && (
                      <>
                        <Icon
                          mx={-1}
                          as={PiLineVerticalThin}
                          boxSize={5}
                          color={dividerColor}
                        />
                        <Swatches
                          label="Graph theme"
                          colors={DEFAULT_PALETTE}
                          value={themeColor}
                          includeTransparent={false}
                          onPick={(color) => {
                            setThemeColor(color);
                            callbacks.onThemeColorChange?.(color);
                          }}
                        />
                      </>
                    )}
                    <WorkflowControls />
                    {!readOnly && (
                      <Swatches
                        label="Graph edge color"
                        colors={DEFAULT_PALETTE}
                        value={edgeColor || (isDark ? "gray.500" : LIGHT_BLACK)}
                        onPick={setEdgeColor}
                        onReset={() => setEdgeColor("")}
                      />
                    )}
                    <DiagramAppearanceControls />
                  </>
                )}

                <Icon
                  mx={-1}
                  as={PiLineVerticalThin}
                  boxSize={5}
                  color={dividerColor}
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
                    onClick={() => {
                      if (config.bottomBarCollapsed === undefined)
                        setLocalCollapsed(!isCollapsed);
                      setBackgroundSelected(isCollapsed);
                      callbacks.onBottomBarCollapsedChange?.(!isCollapsed);
                    }}
                  />
                </ToolbarTooltip>
                {!isCollapsed && <SvgExportButton />}
              </div>
            </HStack>
          </ToolbarScrollContainer>

          {/* Direction picker */}
          {!selectionActive && (
            <Box position="relative" ml="auto" flexShrink={0}>
              <Box
                data-flow-direction-control=""
                bg={background}
                borderRadius="30px"
                h={50}
                css={getInteractionSurface(surfaceColor, borderColor)}
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
                <Box
                  position="absolute"
                  bottom="100%"
                  right={0}
                  pb="24px"
                  zIndex={200}
                >
                  <Box
                    bg={background}
                    borderRadius="30px"
                    p={2}
                    minW="180px"
                    css={getInteractionSurface(surfaceColor, borderColor)}
                  >
                    {DIRECTIONS.map((d) => (
                      <Flex
                        key={d.value}
                        align="center"
                        gap={3}
                        px={3}
                        py={2}
                        css={menuItemCorners}
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
                      css={menuItemCorners}
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
