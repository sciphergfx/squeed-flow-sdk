import { Box, HStack, Icon, Input, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  PiArrowsInLineVertical,
  PiArrowsOutLineVertical,
  PiEraser,
  PiFastForward,
  PiLineSegment,
  PiLineSegments,
  PiLineVerticalThin,
  PiTrash,
  PiX,
} from "react-icons/pi";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import type { SelectionToolbarConfig } from "../types";
import { useFlowData, useFlowDiagramContext } from "./FlowDiagramContext";
import { ToolbarIconButton, ToolbarTooltip } from "./toolbarControls";

export const DEFAULT_PALETTE = [
  "blue.500",
  "teal.500",
  "green.500",
  "yellow.500",
  "orange.500",
  "red.500",
  "purple.500",
  "pink.500",
  "gray.500",
];
const TEXT_PALETTE = ["gray.900", "gray.600", "gray.200", "white"];

type Hide = NonNullable<SelectionToolbarConfig["hide"]>[number];

function useToolbarConfig() {
  const { config } = useFlowDiagramContext();
  const cfg = (config.selectionToolbar || {}) as SelectionToolbarConfig;
  const hidden = new Set<Hide>(cfg.hide || []);
  return {
    palette: cfg.palette || DEFAULT_PALETTE,
    show: (k: Hide) => !hidden.has(k),
  };
}

function Divider() {
  const { border } = useCustomColors();
  return <Icon mx={-1} as={PiLineVerticalThin} boxSize={5} color={border} />;
}

function CloseButton({ onClick }: { onClick: () => void }) {
  const { colorText } = useCustomColors();
  return (
    <ToolbarTooltip label="Close">
      <ToolbarIconButton
        aria-label="Close selection tools"
        icon={<Icon as={PiX} boxSize={5} />}
        size="sm"
        variant="ghost"
        color={colorText}
        onClick={onClick}
      />
    </ToolbarTooltip>
  );
}

function CommitInput({
  value,
  placeholder,
  ariaLabel,
  width = "140px",
  onCommit,
}: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  width?: string;
  onCommit: (v: string) => void;
}) {
  const { colorText, border } = useCustomColors();
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    const t = v.trim();
    if (t !== value) onCommit(t);
  };
  return (
    <Input
      aria-label={ariaLabel}
      size="xs"
      w={width}
      value={v}
      placeholder={placeholder}
      color={colorText}
      borderColor={border}
      borderRadius="8px"
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          setV(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function Swatches({
  colors,
  value,
  label,
  onPick,
  onReset,
}: {
  colors: string[];
  value?: string;
  label: string;
  onPick: (c: string) => void;
  onReset?: () => void;
}) {
  const { colorInactive } = useCustomColors();
  return (
    <HStack gap={1} aria-label={label} role="group">
      {colors.map((c) => {
        const active = value === c;
        return (
          <ToolbarTooltip key={c} label={`${label}: ${c}`}>
            <Box
              as="button"
              aria-label={`${label} ${c}`}
              aria-pressed={active}
              w={4}
              h={4}
              borderRadius="full"
              cursor="pointer"
              style={{ backgroundColor: getChakraColorHex(c) }}
              outline={active ? "2px solid white" : "none"}
              outlineOffset="1px"
              _hover={{ transform: "scale(1.15)" }}
              onClick={() => onPick(c)}
            />
          </ToolbarTooltip>
        );
      })}
      {onReset && (
        <ToolbarTooltip label={`Reset ${label.toLowerCase()}`}>
          <ToolbarIconButton
            aria-label={`Reset ${label}`}
            icon={<Icon as={PiEraser} boxSize={4} />}
            size="xs"
            variant="ghost"
            color={colorInactive}
            onClick={onReset}
          />
        </ToolbarTooltip>
      )}
    </HStack>
  );
}

/** Bottom-bar contents while an edge is selected */
export function EdgeTools({
  edgeId,
  onClose,
}: {
  edgeId: string;
  onClose: () => void;
}) {
  const { callbacks, themeColor } = useFlowDiagramContext();
  const { colorInactive } = useCustomColors();
  const { edgeById } = useFlowData();
  const { palette, show } = useToolbarConfig();
  const data = edgeById.get(edgeId)?.data;
  const style = data?.isEdgeAnimated
    ? "animated"
    : data?.isEdgeDashed
      ? "dashed"
      : "solid";

  const styles: {
    key: "solid" | "dashed" | "animated";
    icon: any;
    label: string;
  }[] = [
    { key: "solid", icon: PiLineSegment, label: "Solid" },
    { key: "dashed", icon: PiLineSegments, label: "Dashed" },
    { key: "animated", icon: PiFastForward, label: "Animated" },
  ];

  return (
    <>
      <CloseButton onClick={onClose} />
      {show("label") && (
        <>
          <Divider />
          <CommitInput
            ariaLabel="Edge label"
            placeholder="Edge label"
            value={data?.label || ""}
            onCommit={(v) => callbacks.onEdgeLabelChange?.(edgeId, v)}
          />
        </>
      )}
      {show("style") && (
        <>
          <Divider />
          {styles.map((s) => (
            <ToolbarTooltip key={s.key} label={s.label}>
              <ToolbarIconButton
                aria-label={`Edge style ${s.key}`}
                aria-pressed={style === s.key}
                icon={<Icon as={s.icon} boxSize={5} />}
                size="sm"
                variant="ghost"
                color={style === s.key ? themeColor : colorInactive}
                onClick={() => callbacks.onEdgeStyleChange?.(edgeId, s.key)}
              />
            </ToolbarTooltip>
          ))}
        </>
      )}
      {show("color") && (
        <>
          <Divider />
          <Swatches
            label="Edge color"
            colors={palette}
            value={data?.color}
            onPick={(c) => callbacks.onEdgeColorChange?.(edgeId, c)}
            onReset={() => callbacks.onEdgeColorChange?.(edgeId, "")}
          />
        </>
      )}
      {show("delete") && (
        <>
          <Divider />
          <ToolbarTooltip label="Delete edge">
            <ToolbarIconButton
              aria-label="Delete edge"
              icon={<Icon as={PiTrash} boxSize={5} />}
              size="sm"
              variant="ghost"
              color="red.400"
              onClick={() => {
                callbacks.onEdgeDelete?.(edgeId, data);
                onClose();
              }}
            />
          </ToolbarTooltip>
        </>
      )}
    </>
  );
}

/** Bottom-bar contents while one or more nodes are selected */
export function NodeTools({
  ids,
  onClose,
}: {
  ids: string[];
  onClose: () => void;
}) {
  const { callbacks, colorMode } = useFlowDiagramContext();
  const { colorText, colorInactive } = useCustomColors();
  const { nodeById } = useFlowData();
  const { palette, show } = useToolbarConfig();
  const single = ids.length === 1;
  const data = single ? nodeById.get(ids[0])?.data : undefined;
  const collapsed = data?.config?.collapsed;
  const each = (fn: (id: string) => void) => ids.forEach(fn);

  return (
    <>
      <CloseButton onClick={onClose} />
      <Divider />
      {single && show("label") ? (
        <CommitInput
          ariaLabel="Node label"
          placeholder="Node label"
          value={data?.label ?? data?.headerTitle ?? ""}
          onCommit={(v) => callbacks.onNodeLabelChange?.(ids[0], v)}
        />
      ) : (
        <Text fontSize="xs" color={colorText} whiteSpace="nowrap" px={1}>
          {ids.length} selected
        </Text>
      )}
      {show("color") && (
        <>
          <Divider />
          <Swatches
            label="Background"
            colors={palette}
            value={data?.viewProps?.bgColor}
            onPick={(c) =>
              each((id) => callbacks.onNodeColorChange?.(id, "bg", c))
            }
            onReset={() =>
              each((id) => callbacks.onNodeColorChange?.(id, "bg", ""))
            }
          />
        </>
      )}
      {show("textColor") && (
        <>
          <Divider />
          <Swatches
            label="Text color"
            colors={TEXT_PALETTE}
            value={data?.viewProps?.textColor}
            onPick={(c) =>
              each((id) => callbacks.onNodeColorChange?.(id, "text", c))
            }
            onReset={() =>
              each((id) => callbacks.onNodeColorChange?.(id, "text", ""))
            }
          />
        </>
      )}
      {single && show("icon") && (
        <>
          <Divider />
          <CommitInput
            ariaLabel="Node icon"
            placeholder="Icon (e.g. PiGear)"
            width="120px"
            value={data?.config?.icon || ""}
            onCommit={(v) => callbacks.onNodeIconChange?.(ids[0], v)}
          />
        </>
      )}
      {single && show("collapse") && collapsed !== undefined && (
        <>
          <Divider />
          <ToolbarTooltip label={collapsed ? "Expand" : "Collapse"}>
            <ToolbarIconButton
              aria-label={collapsed ? "Expand node" : "Collapse node"}
              icon={
                <Icon
                  as={
                    collapsed ? PiArrowsOutLineVertical : PiArrowsInLineVertical
                  }
                  boxSize={5}
                />
              }
              size="sm"
              variant="ghost"
              color={colorInactive}
              onClick={() => callbacks.onNodeCollapse?.(ids[0], !collapsed)}
            />
          </ToolbarTooltip>
        </>
      )}
      {show("delete") && (
        <>
          <Divider />
          <ToolbarTooltip
            label={single ? "Delete node" : `Delete ${ids.length} nodes`}
          >
            <ToolbarIconButton
              aria-label="Delete selected nodes"
              icon={<Icon as={PiTrash} boxSize={5} />}
              size="sm"
              variant="ghost"
              color={colorMode === "dark" ? "red.300" : "red.500"}
              onClick={() => {
                each((id) =>
                  callbacks.onNodeDelete?.(
                    id,
                    nodeById.get(id)?.data || { id },
                  ),
                );
                onClose();
              }}
            />
          </ToolbarTooltip>
        </>
      )}
    </>
  );
}
