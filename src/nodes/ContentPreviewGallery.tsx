import { Box, HStack, Text } from "@chakra-ui/react";
import { useLayoutEffect, useRef, useState } from "react";
import { PiCaretLeft, PiCaretRight, PiCode } from "react-icons/pi";
import {
  useFlowData,
  useFlowDiagramContext,
} from "../components/FlowDiagramContext";
import { CommitInput } from "../components/SelectionToolbar";
import {
  ToolbarIconButton,
  ToolbarTooltip,
} from "../components/toolbarControls";
import { ToolbarScrollContainer } from "../components/ToolbarScrollContainer";
import { useEdgeProximity } from "../hooks/useEdgeProximity";
import { useCustomColors } from "../theme/useCustomColors";
import type { ContentFormat } from "../types";
import { EditableContent } from "./EditableContent";

export function ContentPreviewGallery({ nodeId }: { nodeId: string }) {
  const { nodeById } = useFlowData();
  const { callbacks, config, readOnly, colorMode, isPerformanceMode } =
    useFlowDiagramContext();
  const { background, border, colorInactive, colorText } = useCustomColors();
  const nodes = [...nodeById.values()].filter(
    ({ data }) =>
      data.type !== "grid" &&
      !data.config?.parentContainer &&
      (data.config?.contentFormat === "html" ||
        data.config?.contentFormat === "jsx") &&
      (typeof data.config?.content === "string" ||
        Array.isArray(data.config?.content)),
  );
  const [selectedId, setSelectedId] = useState(nodeId);
  const [editing, setEditing] = useState(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const nearToolbar = useEdgeProximity({
    edge: "top",
    enabled: true,
    bounds: toolbar,
    inside: [toolbar],
    threshold: 90,
  });
  const slide = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const active =
    nodes.find((node) => node.data.id === selectedId) ??
    nodes.find((node) => node.data.id === nodeId) ??
    nodes[0];
  const index = nodes.indexOf(active);
  const editable = !!config.editable && !readOnly;
  const dimension = (value: unknown) => {
    if (typeof value === "number")
      return value > 0 && Number.isFinite(value) ? String(value) : "";
    return typeof value === "string" && /^\d+(\.\d+)?px$/.test(value)
      ? String(parseFloat(value))
      : "";
  };
  const width = dimension(active?.data.viewProps?.width);
  const height = dimension(active?.data.viewProps?.height);
  useLayoutEffect(() => {
    const element = slide.current;
    if (
      !element ||
      config.disableAnimations ||
      isPerformanceMode ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const animation = element.animate(
      {
        transform: [`translateX(${direction.current * 100}%)`, "translateX(0)"],
      },
      { duration: 240, easing: "ease-out", id: "flow-content-slide" },
    );
    return () => animation.cancel();
  }, [active?.data.id, config.disableAnimations, isPerformanceMode]);
  const navigate = (offset: number) => {
    const next = nodes[index + offset];
    if (!next || editing) return;
    direction.current = offset;
    setSelectedId(next.data.id);
  };
  if (!active)
    return (
      <Box role="status" p={4}>
        No HTML or JSX content available.
      </Box>
    );
  return (
    <Box
      data-content-gallery=""
      position="relative"
      h="100%"
      display="flex"
      flexDirection="column"
      minH={0}
      color={colorText}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Box
        ref={toolbar}
        role="toolbar"
        aria-label="Preview controls"
        position="absolute"
        top="8px"
        left="8px"
        w="max-content"
        maxW="calc(100% - 76px)"
        zIndex={2}
        css={{
          "@media (hover: hover) and (pointer: fine)": {
            opacity: nearToolbar ? 1 : 0,
          },
          "&:hover, &:focus-within": { opacity: 1 },
        }}
      >
        <ToolbarScrollContainer
          background={background}
          border={colorMode === "dark" ? border : "gray.300"}
        >
          <HStack px={2} gap={2} width="max-content" height="100%">
            <ToolbarTooltip label="Previous content">
              <ToolbarIconButton
                data-flow-content-navigation=""
                aria-label="Previous content"
                icon={<PiCaretLeft size={20} />}
                disabled={index <= 0 || editing}
                onClick={() => navigate(-1)}
                rememberAction={false}
                size="sm"
                variant="ghost"
              />
            </ToolbarTooltip>
            <Text
              aria-live="polite"
              fontSize="12px"
              minW="42px"
              textAlign="center"
            >
              {index + 1} / {nodes.length}
            </Text>
            <ToolbarTooltip label="Next content">
              <ToolbarIconButton
                data-flow-content-navigation=""
                aria-label="Next content"
                icon={<PiCaretRight size={20} />}
                disabled={index >= nodes.length - 1 || editing}
                onClick={() => navigate(1)}
                rememberAction={false}
                size="sm"
                variant="ghost"
              />
            </ToolbarTooltip>
            {(["width", "height"] as const).map((axis) => (
              <Box
                key={`${active.data.id}:${axis}`}
                as="label"
                display="flex"
                alignItems="center"
                gap={1}
                fontSize="12px"
                opacity={editable ? 1 : 0.5}
              >
                {axis === "width" ? "W" : "H"}
                <CommitInput
                  value={axis === "width" ? width : height}
                  placeholder="Auto"
                  ariaLabel={`Content ${axis}`}
                  type="number"
                  min={1}
                  width="72px"
                  disabled={
                    !editable || !callbacks.onNodeDimensionChange || editing
                  }
                  onCommit={(value) => {
                    if (editable)
                      callbacks.onNodeDimensionChange?.(
                        active.data.id,
                        axis,
                        value === "" ? undefined : Number(value),
                      );
                  }}
                />
              </Box>
            ))}
            {editable && !editing && (
              <ToolbarTooltip label="Edit content source">
                <ToolbarIconButton
                  aria-label="Edit content source"
                  icon={<PiCode size={20} />}
                  onClick={() => setEditing(true)}
                  rememberAction={false}
                  size="sm"
                  variant="ghost"
                  color={colorInactive}
                />
              </ToolbarTooltip>
            )}
          </HStack>
        </ToolbarScrollContainer>
      </Box>
      <Box
        flex={1}
        minH={0}
        overflow="auto"
        position="relative"
        data-content-slide-viewport=""
      >
        <Box
          ref={slide}
          key={active.data.id}
          data-content-slide={active.data.id}
          width={width ? `${width}px` : "100%"}
          height={height ? `${height}px` : "100%"}
          minH={height ? undefined : "100%"}
          mx="auto"
          overflow="auto"
        >
          <EditableContent
            key={`${active.data.id}:${editing}`}
            nodeId={active.data.id}
            content={active.data.config.content}
            format={active.data.config.contentFormat as ContentFormat}
            color={colorText}
            previewControls={false}
            editOnMount={editing}
            onEditEnd={() => setEditing(false)}
          />
        </Box>
      </Box>
    </Box>
  );
}
