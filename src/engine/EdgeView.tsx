import { memo, useMemo } from "react";
import {
  loopGeometry,
  propertyGeometry,
  taxiGeometry,
  type EdgeGeometryOptions,
  type TaxiDir,
} from "./geometry";
import { EDGE_LABEL_FONT_FAMILY, measureText, wrapText } from "./text";
import type { Box } from "./types";

// chartStyles.ts equivalents (model units)
export const EDGE_WIDTH = 6;
const ARROW_SCALE = 3;
/** cytoscape `getArrowWidth(width, scale)` */
export const ARROW_SIZE =
  Math.max(Math.pow(EDGE_WIDTH * 13.37, 0.9), 29) * ARROW_SCALE;
/** cytoscape triangle `gap`: width × arrow-scale × 2 */
const ARROW_GAP = EDGE_WIDTH * ARROW_SCALE * 2;
const STANDOFF = 80;
const TAXI_RADIUS = 500;
const LABEL_FONT_SIZE = 45;
const LABEL_MAX_WIDTH = 200;
const LABEL_PADDING = 15;
const LABEL_MARGIN_X = 50;
const LABEL_FONT = `${LABEL_FONT_SIZE}px ${EDGE_LABEL_FONT_FAMILY}`;
export const DASH_PATTERN = "32 18";

export interface EdgeViewProps {
  id: string;
  source: Box;
  target: Box;
  sourceProperty?: string;
  targetProperty?: string;
  sourceY?: number;
  targetY?: number;
  dir: TaxiDir;
  /** taxi-turn as a fraction of the gap between the nodes */
  turn: number;
  color: string;
  labelBg: string;
  label?: string;
  dashed?: boolean;
  animated?: boolean;
  /** Arrow drawn at the source end instead of the target */
  inverted?: boolean;
  loopIndex?: number;
  onSelect?: (id: string) => void;
}

const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

function EdgeView({
  id,
  source,
  target,
  sourceProperty,
  targetProperty,
  sourceY,
  targetY,
  dir,
  turn,
  color,
  labelBg,
  label,
  dashed,
  animated,
  inverted,
  loopIndex = 0,
  onSelect,
}: EdgeViewProps) {
  const geo = useMemo(() => {
    const opts: EdgeGeometryOptions = {
      srcDist: STANDOFF,
      tgtDist: STANDOFF,
      arrowGap: ARROW_GAP,
      arrowSize: ARROW_SIZE,
      radius: TAXI_RADIUS,
      arrowAt: inverted ? "source" : "target",
    };
    if (sourceY !== undefined || targetY !== undefined)
      return propertyGeometry(source, target, dir, sourceY, targetY, turn, {
        ...opts,
        srcDist: 18,
        tgtDist: 18,
      });
    if (source.x === target.x && source.y === target.y)
      return loopGeometry(source, loopIndex, {
        ...opts,
        srcDist: 0,
        tgtDist: 0,
      });
    return taxiGeometry(source, target, dir, turn, opts);
  }, [source, target, sourceY, targetY, dir, turn, inverted, loopIndex]);

  const lines = useMemo(
    () => (label ? wrapText(label, LABEL_FONT, LABEL_MAX_WIDTH) : []),
    [label],
  );

  if (!geo) return null;

  const dashArray = dashed || animated ? DASH_PATTERN : undefined;
  const animClass = animated
    ? `flow-sdk-edge-anim${inverted ? " flow-sdk-edge-anim-rev" : ""}`
    : undefined;

  let labelEl: React.ReactNode = null;
  if (lines.length) {
    const w = Math.max(...lines.map((l) => measureText(l, LABEL_FONT)));
    const h = lines.length * LABEL_FONT_SIZE;
    labelEl = (
      <g
        className="flow-sdk-edge-label"
        transform={`translate(${geo.label.x} ${geo.label.y}) rotate(${geo.label.angle}) translate(${LABEL_MARGIN_X} 0)`}
      >
        <rect
          x={-w / 2 - LABEL_PADDING}
          y={-h / 2 - LABEL_PADDING}
          width={w + 2 * LABEL_PADDING}
          height={h + 2 * LABEL_PADDING}
          fill={labelBg}
        />
        <text
          fill={color}
          fontSize={LABEL_FONT_SIZE}
          fontFamily={EDGE_LABEL_FONT_FAMILY}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {lines.map((l, i) => (
            <tspan
              key={i}
              x={0}
              y={(i - (lines.length - 1) / 2) * LABEL_FONT_SIZE}
            >
              {l}
            </tspan>
          ))}
        </text>
      </g>
    );
  }

  return (
    <g
      className="flow-sdk-edge"
      data-edge-id={id}
      data-source-property={sourceProperty}
      data-target-property={targetProperty}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(id);
      }}
    >
      <path
        d={geo.d}
        fill="none"
        stroke={color}
        strokeWidth={EDGE_WIDTH}
        strokeDasharray={dashArray}
        className={animClass}
      />
      {geo.arrow && <path d={geo.arrow} fill={color} />}
      {labelEl}
      <path className="flow-sdk-edge-hit" d={geo.d} />
    </g>
  );
}

export default memo(EdgeView);
