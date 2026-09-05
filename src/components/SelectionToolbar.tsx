import { Box, HStack, Icon, Input, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import {
  PiArrowsInLineVertical,
  PiArrowsOutLineVertical,
  PiBoundingBox,
  PiEraser,
  PiFastForward,
  PiLineSegment,
  PiLineSegments,
  PiLineVerticalThin,
  PiSpinnerGap,
  PiSquare,
  PiSquareFill,
  PiTrash,
  PiX,
} from "react-icons/pi";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import { getNodeBorderWidth } from "../nodes/nodeBorder";
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
  type = "text",
  min,
  onCommit,
}: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  width?: string;
  type?: "text" | "number";
  min?: number;
  onCommit: (v: string) => void;
}) {
  const { colorText } = useCustomColors();
  const [v, setV] = useState(value);
  const committedRef = useRef(false);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const t = v.trim();
    if (
      type === "number" &&
      t !== "" &&
      (!Number.isFinite(Number(t)) || Number(t) < (min ?? 0))
    ) {
      setV(value);
      return;
    }
    if (t !== value) onCommit(t);
  };
  return (
    <Input
      aria-label={ariaLabel}
      type={type}
      min={min}
      size="xs"
      w={width}
      value={v}
      placeholder={placeholder}
      color={colorText}
      borderWidth={0}
      _focusVisible={{ boxShadow: "none", outline: "none" }}
      borderRadius="8px"
      onFocus={() => {
        committedRef.current = false;
      }}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          committedRef.current = true;
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
  const { colorInactive, colorText } = useCustomColors();
  return (
    <HStack gap={1} aria-label={label} role="group">
      {[...new Set([...colors, "transparent"])].map((c) => {
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
              style={{
                backgroundColor: getChakraColorHex(c),
                ...(c === "transparent"
                  ? {
                      backgroundImage:
                        "conic-gradient(#fff 25%, #a0aec0 0 50%, #fff 0 75%, #a0aec0 0)",
                      backgroundSize: "8px 8px",
                    }
                  : {}),
              }}
              outline={
                active ? `2px solid ${getChakraColorHex(colorText)}` : "none"
              }
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
  const { callbacks, themeColor, config } = useFlowDiagramContext();
  const { colorInactive } = useCustomColors();
  const { edgeById } = useFlowData();
  const { palette, show } = useToolbarConfig();
  const data = edgeById.get(edgeId)?.data;
  const edgeTypes = [
    ...new Set([
      "rounded-orthogonal",
      "orthogonal",
      "straight",
      "bezier",
      ...Object.keys(config.customEdgeTypes ?? {}),
      ...(data?.type ? [data.type] : []),
    ]),
  ];
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
          <select
            aria-label="Edge shape"
            title="Edge shape"
            value={data?.type ?? ""}
            disabled={config.readOnly}
            onChange={(event) =>
              callbacks.onEdgeTypeChange?.(
                edgeId,
                event.target.value || undefined,
              )
            }
            style={{
              width: 160,
              height: 30,
              fontSize: 12,
              padding: "0 6px",
              border: "1px solid #718096",
              borderRadius: 4,
              background: config.colorMode === "dark" ? "#1A202C" : "#ffffff",
              color: config.colorMode === "dark" ? "#EDF2F7" : "#1A202C",
            }}
          >
            <option value="">Default</option>
            {edgeTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
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
  const { callbacks, colorMode, themeColor, config } = useFlowDiagramContext();
  const { colorText, colorInactive } = useCustomColors();
  const { nodeById, parentIds } = useFlowData();
  const { palette, show } = useToolbarConfig();
  const single = ids.length === 1;
  const data = single ? nodeById.get(ids[0])?.data : undefined;
  const collapsed = data?.config?.collapsed;
  const isOutlined = (id: string) =>
    (nodeById.get(id)?.data.viewProps?.outline ??
      (parentIds.has(id) ? config.parentNodeStyle?.outline : false)) === true;
  const outlined = ids.every(isOutlined);
  const mixedOutline = !outlined && ids.some(isOutlined);
  const isAnimated = (id: string) =>
    nodeById.get(id)?.data.isNodeAnimated === true;
  const animated = ids.every(isAnimated);
  const mixedAnimation = !animated && ids.some(isAnimated);
  const each = (fn: (id: string) => void) => ids.forEach(fn);
  const [borderMode, setBorderMode] = useState(false);
  const editingBorder = borderMode && show("color") && show("borderColor");
  const isDashed = (id: string) =>
    (nodeById.get(id)?.data.viewProps?.borderStyle ??
      (parentIds.has(id) ? config.parentNodeStyle?.borderStyle : "solid")) ===
    "dashed";
  const dashed = ids.every(isDashed);
  const mixedDashed = !dashed && ids.some(isDashed);
  const widths = ids.map((id) => {
    const node = nodeById.get(id)?.data;
    const fallback = parentIds.has(id)
      ? getNodeBorderWidth(config.parentNodeStyle?.borderWidth, 6)
      : node?.type === "objectView"
        ? 3
        : 2;
    return getNodeBorderWidth(node?.viewProps?.borderWidth, fallback);
  });
  const borderWidth = widths.every((width) => width === widths[0])
    ? String(widths[0] ?? "")
    : "";
  const updateColor = (color: string) =>
    each((id) => {
      if (editingBorder) callbacks.onNodeBorderColorChange?.(id, color);
      else callbacks.onNodeColorChange?.(id, "bg", color);
    });

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
      {show("outline") && (
        <>
          <Divider />
          <ToolbarTooltip
            label={outlined ? "Restore node fill" : "Remove node fill"}
          >
            <ToolbarIconButton
              aria-label="Toggle node outline"
              aria-pressed={mixedOutline ? "mixed" : outlined}
              icon={
                <Icon as={outlined ? PiSquare : PiSquareFill} boxSize={5} />
              }
              size="sm"
              variant="ghost"
              color={outlined ? themeColor : colorInactive}
              onClick={() =>
                each((id) => callbacks.onNodeOutlineChange?.(id, !outlined))
              }
            />
          </ToolbarTooltip>
        </>
      )}
      {show("color") && (
        <>
          <Divider />
          {show("borderColor") && (
            <ToolbarTooltip
              label={editingBorder ? "Edit node colors" : "Edit node border"}
            >
              <ToolbarIconButton
                aria-label="Edit node border"
                aria-pressed={editingBorder}
                icon={<Icon as={PiBoundingBox} boxSize={5} />}
                size="sm"
                variant="ghost"
                color={editingBorder ? themeColor : colorInactive}
                bg={
                  editingBorder
                    ? colorMode === "dark"
                      ? "whiteAlpha.200"
                      : "blackAlpha.100"
                    : undefined
                }
                onClick={() => setBorderMode((current) => !current)}
              />
            </ToolbarTooltip>
          )}
          <Swatches
            label={editingBorder ? "Border color" : "Background"}
            colors={palette}
            value={
              editingBorder
                ? (data?.viewProps?.borderColor ??
                  (single && parentIds.has(ids[0])
                    ? config.parentNodeStyle?.borderColor
                    : undefined))
                : data?.viewProps?.bgColor
            }
            onPick={updateColor}
            onReset={() => updateColor("")}
          />
          {editingBorder && show("style") && (
            <>
              <Divider />
              <ToolbarTooltip label={dashed ? "Solid border" : "Dashed border"}>
                <ToolbarIconButton
                  aria-label="Toggle dashed border"
                  aria-pressed={mixedDashed ? "mixed" : dashed}
                  icon={
                    <Icon
                      as={dashed ? PiLineSegments : PiLineSegment}
                      boxSize={5}
                    />
                  }
                  size="sm"
                  variant="ghost"
                  color={dashed ? themeColor : colorInactive}
                  onClick={() =>
                    each((id) =>
                      callbacks.onNodeBorderStyleChange?.(
                        id,
                        dashed ? "solid" : "dashed",
                      ),
                    )
                  }
                />
              </ToolbarTooltip>
              <CommitInput
                ariaLabel="Border thickness"
                placeholder={single ? "Auto" : "Mixed"}
                width="64px"
                type="number"
                min={0}
                value={borderWidth}
                onCommit={(value) =>
                  each((id) =>
                    callbacks.onNodeBorderWidthChange?.(
                      id,
                      value === "" ? undefined : Number(value),
                    ),
                  )
                }
              />
            </>
          )}
        </>
      )}
      {show("animation") && (
        <>
          <Divider />
          <ToolbarTooltip
            label={animated ? "Stop border animation" : "Animate node border"}
          >
            <ToolbarIconButton
              aria-label="Toggle node animation"
              aria-pressed={mixedAnimation ? "mixed" : animated}
              icon={<Icon as={PiSpinnerGap} boxSize={5} />}
              size="sm"
              variant="ghost"
              color={animated ? themeColor : colorInactive}
              onClick={() =>
                each((id) => callbacks.onNodeAnimationChange?.(id, !animated))
              }
            />
          </ToolbarTooltip>
        </>
      )}
      {!editingBorder && show("textColor") && (
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
