import { memo } from "react";
import { PiCircleFill } from "react-icons/pi";
import {
  ToolbarIconButton,
  ToolbarTooltip,
} from "../components/toolbarControls";
import { createPortal } from "react-dom";
import { NodeBorderAnimation } from "./NodeBorderAnimation";
import { EDGE_LABEL_FONT_FAMILY, measureText } from "./text";
import type { Rect } from "./types";
import type { NodeSelectionModifiers } from "../types";

export interface ContainerStyle {
  /** hex */
  bgColor: string;
  bgOpacity: number;
  /** hex */
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dashed" | "dotted" | "double";
  borderRadius: number;
  /** hex */
  textColor: string;
  fontSize: number;
  labelPosition: "top" | "center" | "bottom";
  /** cytoscape `text-margin-y` magnitude for top/bottom placement */
  labelMargin: number;
  labelBg: string;
  animated?: boolean;
  animationColor?: string;
}

export interface ContainerViewProps {
  id: string;
  rect: Rect;
  label?: string;
  labelLayer?: SVGGElement | null;
  style: ContainerStyle;
  onSelect?: (id: string, modifiers?: NodeSelectionModifiers) => void;
  onCollapse?: (id: string) => void;
  selected?: boolean;
}

const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

function ContainerView({
  id,
  rect,
  label,
  labelLayer,
  style,
  onSelect,
  onCollapse,
  selected = false,
}: ContainerViewProps) {
  const w = rect.x2 - rect.x1;
  const h = rect.y2 - rect.y1;
  const bw = style.borderWidth;
  const dash =
    style.borderStyle === "dashed"
      ? `${bw * 4} ${bw * 2}`
      : style.borderStyle === "dotted"
        ? `${bw} ${bw}`
        : undefined;
  const cx = rect.x1 + w / 2;
  const labelY =
    style.labelPosition === "top"
      ? rect.y1 + style.labelMargin - style.fontSize / 2
      : style.labelPosition === "bottom"
        ? rect.y2 - style.labelMargin + style.fontSize / 2
        : rect.y1 + h / 2;

  const labelWidth = label
    ? measureText(label, `bold ${style.fontSize}px ${EDGE_LABEL_FONT_FAMILY}`)
    : 0;
  const padding = style.fontSize / 5;
  const labelElement =
    label || (selected && onCollapse) ? (
      <g className="flow-sdk-container-label" data-node-id={id}>
        {selected && onCollapse && (
          <foreignObject
            x={label ? cx + labelWidth / 2 + padding : rect.x2 - 56}
            y={label ? labelY - 24 : rect.y1 + 8}
            width={48}
            height={48}
            data-flow-content-toggle=""
            style={{ pointerEvents: "auto" }}
          >
            <ToolbarTooltip label="Show icon">
              <ToolbarIconButton
                aria-label="Show icon"
                icon={<PiCircleFill />}
                variant="ghost"
                style={{ width: 48, height: 48, color: style.textColor }}
                onClick={(event) => {
                  event.stopPropagation();
                  onCollapse(id);
                }}
              />
            </ToolbarTooltip>
          </foreignObject>
        )}
        {label && (
          <>
            <rect
              x={cx - labelWidth / 2 - padding}
              y={labelY - style.fontSize / 2 - padding}
              width={labelWidth + 2 * padding}
              height={style.fontSize + 2 * padding}
              fill={
                style.textColor === "transparent"
                  ? "transparent"
                  : style.labelBg
              }
            />
            <text
              x={cx}
              y={labelY}
              fill={style.textColor}
              fontSize={style.fontSize}
              fontWeight="bold"
              fontFamily={EDGE_LABEL_FONT_FAMILY}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          </>
        )}
      </g>
    ) : null;

  return (
    <g
      className="flow-sdk-container"
      data-node-id={id}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(id, {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
        });
      }}
    >
      <rect
        x={rect.x1}
        y={rect.y1}
        width={w}
        height={h}
        rx={style.borderRadius}
        ry={style.borderRadius}
        fill={style.bgColor}
        fillOpacity={style.bgOpacity}
        stroke={style.borderColor}
        strokeWidth={style.borderStyle === "double" ? bw / 3 : bw}
        strokeDasharray={dash}
      />
      {style.borderStyle === "double" && (
        <rect
          x={rect.x1 + (bw * 2) / 3}
          y={rect.y1 + (bw * 2) / 3}
          width={Math.max(0, w - (bw * 4) / 3)}
          height={Math.max(0, h - (bw * 4) / 3)}
          rx={Math.max(0, style.borderRadius - (bw * 2) / 3)}
          ry={Math.max(0, style.borderRadius - (bw * 2) / 3)}
          fill="none"
          stroke={style.borderColor}
          strokeWidth={bw / 3}
        />
      )}
      {style.animated && bw > 0 && (
        <NodeBorderAnimation
          x={rect.x1}
          y={rect.y1}
          width={w}
          height={h}
          radius={style.borderRadius}
          color={style.animationColor || style.borderColor}
          strokeWidth={Math.max(8, bw * 1.6)}
        />
      )}
      {labelLayer && labelElement
        ? createPortal(labelElement, labelLayer)
        : labelElement}
    </g>
  );
}

export default memo(ContainerView);
