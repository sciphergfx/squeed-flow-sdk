import { memo, useMemo } from "react";
import { createPortal } from "react-dom";
import DynamicIcon from "../utils/DynamicIcon";
import type {
  FlowDiagramConfig,
  FlowDiagramEdge,
  FlowDirection,
} from "../types";
import {
  loopGeometry,
  bezierGeometry,
  connectorEndpoints,
  polylineGeometry,
  straightPortGeometry,
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
  validationIssue?: string;
  id: string;
  edgeData?: FlowDiagramEdge["data"];
  edgeType?: string;
  edgeRadius?: number;
  customEdgeTypes?: FlowDiagramConfig["customEdgeTypes"];
  source: Box;
  target: Box;
  sourceProperty?: string;
  targetProperty?: string;
  sourceY?: number;
  targetY?: number;
  propertyMode?: boolean;
  dir: TaxiDir;
  /** taxi-turn as a fraction of the gap between the nodes */
  turn: number;
  labelAtTarget?: boolean;
  labelFraction?: number;
  color: string;
  labelBg: string;
  labelLayer?: SVGGElement | null;
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
  edgeData,
  validationIssue,
  edgeType = "rounded-orthogonal",
  edgeRadius,
  customEdgeTypes,
  source,
  target,
  sourceProperty,
  targetProperty,
  sourceY,
  targetY,
  propertyMode = false,
  dir,
  turn,
  labelAtTarget,
  labelFraction,
  color,
  labelBg,
  labelLayer,
  label,
  dashed,
  animated,
  inverted,
  loopIndex = 0,
  onSelect,
}: EdgeViewProps) {
  const lines = useMemo(
    () => (label ? wrapText(label, LABEL_FONT, LABEL_MAX_WIDTH) : []),
    [label],
  );
  const icon = edgeData?.icon;
  const iconWidth = icon ? 48 + (lines.length ? 12 : 0) : 0;
  const labelWidth =
    iconWidth +
    Math.max(0, ...lines.map((line) => measureText(line, LABEL_FONT)));
  const geo = useMemo(() => {
    const opts: EdgeGeometryOptions = {
      srcDist: STANDOFF,
      tgtDist: STANDOFF,
      arrowGap: ARROW_GAP,
      arrowSize: ARROW_SIZE,
      headShape:
        propertyMode &&
        (inverted ? sourceY !== undefined : targetY !== undefined)
          ? "square"
          : "triangle",
      radius: edgeRadius ?? (labelAtTarget ? 40 : TAXI_RADIUS),
      arrowAt: inverted ? "source" : "target",
      labelTargetLength: labelAtTarget
        ? labelWidth + 2 * LABEL_PADDING
        : undefined,
      labelFraction: labelAtTarget ? labelFraction : undefined,
    };
    const property = sourceY !== undefined || targetY !== undefined;
    const loop = source.x === target.x && source.y === target.y;
    const defaultGeometry = property
      ? propertyGeometry(source, target, dir, sourceY, targetY, turn, {
          ...opts,
          srcDist: 18,
          tgtDist: 18,
          radius: edgeRadius ?? Math.min(opts.radius, 40),
        })
      : loop
        ? loopGeometry(source, loopIndex, {
            ...opts,
            srcDist: 0,
            tgtDist: 0,
          })
        : taxiGeometry(source, target, dir, turn, opts);
    if (!defaultGeometry) return null;
    const endpoints = connectorEndpoints(
      source,
      target,
      dir,
      sourceY,
      targetY,
      property ? 18 : STANDOFF,
    );
    const factory = Object.prototype.hasOwnProperty.call(
      customEdgeTypes ?? {},
      edgeType,
    )
      ? customEdgeTypes?.[edgeType]
      : undefined;
    if (factory) {
      const directions: Record<TaxiDir, FlowDirection> = {
        rightward: "LR",
        leftward: "RL",
        downward: "TB",
        upward: "BT",
      };
      return (
        factory({
          edge: edgeData ?? { id, source: "", target: "" },
          source: { ...source },
          target: { ...target },
          ...endpoints,
          direction: directions[dir],
          sourceY,
          targetY,
          inverted: !!inverted,
          defaultGeometry,
        }) ?? defaultGeometry
      );
    }
    if (loop) return defaultGeometry;
    if (edgeType === "straight")
      return property
        ? straightPortGeometry(
            endpoints.sourcePoint,
            endpoints.targetPoint,
            opts,
          )
        : polylineGeometry([source, target], source, target, opts);
    if (edgeType === "bezier")
      return bezierGeometry(
        endpoints.sourcePoint,
        endpoints.targetPoint,
        property ? (dir === "leftward" ? "leftward" : "rightward") : dir,
        opts,
      );
    if (edgeType === "orthogonal")
      return property
        ? propertyGeometry(source, target, dir, sourceY, targetY, turn, {
            ...opts,
            srcDist: 18,
            tgtDist: 18,
            radius: 0,
          })
        : taxiGeometry(source, target, dir, turn, { ...opts, radius: 0 });
    return defaultGeometry;
  }, [
    source,
    id,
    edgeData,
    edgeType,
    edgeRadius,
    customEdgeTypes,
    target,
    propertyMode,
    sourceY,
    targetY,
    dir,
    turn,
    inverted,
    loopIndex,
    labelAtTarget,
    labelFraction,
    labelWidth,
  ]);

  if (!geo) return null;

  const validationColor = validationIssue?.startsWith("Unverified:")
    ? "#b45309"
    : "#dc2626";
  const displayColor = validationIssue ? validationColor : color;
  const validationEl = validationIssue ? (
    <g
      className="flow-sdk-edge-validation"
      role="img"
      aria-label={validationIssue}
      transform={`translate(${geo.label.x} ${geo.label.y - (lines.length * LABEL_FONT_SIZE) / 2 - 55})`}
    >
      <title>{validationIssue}</title>
      <DynamicIcon
        name="PiWarningCircleFill"
        svg
        size={48}
        x={-24}
        y={-24}
        color={validationColor}
      />
    </g>
  ) : null;

  const dashArray = dashed || animated ? DASH_PATTERN : undefined;
  const animClass = animated
    ? `flow-sdk-edge-anim${inverted ? " flow-sdk-edge-anim-rev" : ""}`
    : undefined;

  let labelEl: React.ReactNode = null;
  if (lines.length || icon) {
    const w = labelWidth;
    const h = Math.max(lines.length * LABEL_FONT_SIZE, icon ? 48 : 0);
    labelEl = (
      <g
        className="flow-sdk-edge-label"
        data-label-transform={`translate(${geo.label.x} ${geo.label.y}) rotate(${geo.label.angle}) translate(${labelAtTarget || Object.prototype.hasOwnProperty.call(customEdgeTypes ?? {}, edgeType) ? 0 : LABEL_MARGIN_X} 0)`}
        data-edge-id={id}
        data-source-property={sourceProperty}
        data-target-property={targetProperty}
        transform={`translate(${geo.label.x} ${geo.label.y}) rotate(${geo.label.angle}) translate(${labelAtTarget || Object.prototype.hasOwnProperty.call(customEdgeTypes ?? {}, edgeType) ? 0 : LABEL_MARGIN_X} 0)`}
      >
        <rect
          x={-w / 2 - LABEL_PADDING}
          y={-h / 2 - LABEL_PADDING}
          width={w + 2 * LABEL_PADDING}
          height={h + 2 * LABEL_PADDING}
          fill={color === "transparent" ? "transparent" : labelBg}
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
              x={iconWidth / 2}
              y={(i - (lines.length - 1) / 2) * LABEL_FONT_SIZE}
            >
              {l}
            </tspan>
          ))}
        </text>
        {icon && (
          <g
            className="flow-sdk-edge-icon"
            opacity={color === "transparent" ? 0 : 1}
          >
            <title>{label ? `Edge icon: ${label}` : "Edge icon"}</title>
            <rect
              x={-w / 2}
              y={-24}
              width={48}
              height={48}
              fill="transparent"
            />
            <DynamicIcon
              name={icon}
              svg
              size={48}
              x={-w / 2}
              y={-24}
              color={color}
            />
          </g>
        )}
      </g>
    );
  }

  return (
    <g
      className="flow-sdk-edge"
      data-edge-id={id}
      data-source-property={sourceProperty}
      data-target-property={targetProperty}
      data-validation={
        validationIssue
          ? validationIssue.startsWith("Unverified:")
            ? "unverified"
            : "invalid"
          : undefined
      }
      aria-label={validationIssue}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(id);
      }}
    >
      <path
        d={geo.d}
        fill="none"
        stroke={displayColor}
        strokeWidth={EDGE_WIDTH}
        strokeDasharray={dashArray}
        className={animClass}
      />
      {geo.arrow && <path d={geo.arrow} fill={displayColor} />}
      {labelLayer && labelEl ? createPortal(labelEl, labelLayer) : labelEl}
      {labelLayer && validationEl
        ? createPortal(validationEl, labelLayer)
        : validationEl}
      <path className="flow-sdk-edge-hit" d={geo.d} />
    </g>
  );
}

export default memo(EdgeView);
