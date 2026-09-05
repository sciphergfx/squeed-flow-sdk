import { memo } from "react";
import { EDGE_LABEL_FONT_FAMILY } from "./text";
import type { Rect } from "./types";

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
}

export interface ContainerViewProps {
  id: string;
  rect: Rect;
  label?: string;
  style: ContainerStyle;
  onSelect?: (id: string) => void;
}

const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

function ContainerView({
  id,
  rect,
  label,
  style,
  onSelect,
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

  return (
    <g
      className="flow-sdk-container"
      data-node-id={id}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(id);
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
      {label && (
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
      )}
    </g>
  );
}

export default memo(ContainerView);
