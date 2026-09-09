import { memo, useMemo } from "react";
import { createPortal } from "react-dom";
import type {
  FlowDiagramConfig,
  FlowDiagramEdge,
  FlowDirection,
} from "../types";
import DynamicIcon from "../utils/DynamicIcon";
import {
  LABEL_FONT_SIZE,
  LABEL_MARGIN_X,
  LABEL_PADDING,
  measureEdgeLabel,
  NODE_LABEL_FONT_SIZE,
} from "./edgeLabel";
import { EdgeReveal } from "./EdgeReveal";
import { EdgeTraceAnimation } from "./EdgeTraceAnimation";
import {
  bezierGeometry,
  connectorEndpoints,
  loopGeometry,
  perimeterGeometry,
  polylineGeometry,
  portOffset,
  propertyGeometry,
  straightPortGeometry,
  taxiGeometry,
  type EdgeGeometryOptions,
  type TaxiDir,
} from "./geometry";
import { EDGE_LABEL_FONT_FAMILY } from "./text";
import type { Box, PortAnchor } from "./types";

import { ARROW_GAP, ARROW_SIZE, EDGE_WIDTH, STANDOFF } from "./edgeMetrics";
export { ARROW_SIZE, EDGE_WIDTH } from "./edgeMetrics";
const TAXI_RADIUS = 500;
export const DASH_PATTERN = "32 18";

export interface EdgeViewProps {
  reveal?: FlowDiagramConfig["edgeReveal"];
  onRevealComplete?: (id: string) => void;
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
  sourcePort?: PortAnchor;
  targetPort?: PortAnchor;
  propertyMode?: boolean;
  dir: TaxiDir;
  /** taxi-turn as a fraction of the gap between the nodes */
  turn: number;
  labelAtTarget?: boolean;
  labelFraction?: number;
  color: string;
  connectorColor?: string;
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
  reveal,
  onRevealComplete,
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
  sourcePort,
  targetPort,
  propertyMode = false,
  dir,
  turn,
  labelAtTarget,
  labelFraction,
  color,
  connectorColor,
  labelBg,
  labelLayer,
  label,
  dashed,
  animated,
  inverted,
  loopIndex = 0,
  onSelect,
}: EdgeViewProps) {
  const icon = edgeData?.icon;
  const labelFontSize = propertyMode ? LABEL_FONT_SIZE : NODE_LABEL_FONT_SIZE;
  const {
    lines,
    iconWidth,
    contentWidth: labelWidth,
    contentHeight: labelHeight,
  } = useMemo(
    () => measureEdgeLabel(label, icon, labelFontSize),
    [label, icon, labelFontSize],
  );
  const geo = useMemo(() => {
    const opts: EdgeGeometryOptions = {
      srcDist: STANDOFF,
      tgtDist: STANDOFF,
      arrowGap: ARROW_GAP,
      arrowSize: ARROW_SIZE,
      headShape:
        propertyMode &&
        (inverted
          ? sourceY !== undefined || !!sourcePort
          : targetY !== undefined || !!targetPort)
          ? "square"
          : "triangle",
      radius: edgeRadius ?? (labelAtTarget ? 40 : TAXI_RADIUS),
      arrowAt: inverted ? "source" : "target",
      labelTargetLength: labelAtTarget
        ? labelWidth + 2 * LABEL_PADDING
        : undefined,
      labelFraction: labelAtTarget ? labelFraction : undefined,
    };
    const property =
      sourceY !== undefined ||
      targetY !== undefined ||
      !!sourcePort ||
      !!targetPort;
    const baseEndpoints = connectorEndpoints(
      source,
      target,
      dir,
      sourceY,
      targetY,
      0,
    );
    const vertical =
      sourceY === undefined &&
      targetY === undefined &&
      (dir === "downward" || dir === "upward");
    const sourceAnchor: PortAnchor = sourcePort ?? {
      ...baseEndpoints.sourcePoint,
      side: vertical
        ? dir === "upward"
          ? "top"
          : "bottom"
        : dir === "leftward"
          ? "left"
          : "right",
    };
    const targetAnchor: PortAnchor = targetPort ?? {
      ...baseEndpoints.targetPoint,
      side: vertical
        ? dir === "upward"
          ? "bottom"
          : "top"
        : dir === "leftward"
          ? "right"
          : "left",
    };
    const loop = source.x === target.x && source.y === target.y;
    const defaultGeometry =
      sourcePort || targetPort
        ? perimeterGeometry(
            sourceAnchor,
            targetAnchor,
            { ...opts, srcDist: 18, tgtDist: 18 },
            edgeType,
          )
        : property
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
    if (sourcePort) endpoints.sourcePoint = portOffset(sourcePort, 18);
    if (targetPort) endpoints.targetPoint = portOffset(targetPort, 18);
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
    if (loop || sourcePort || targetPort) return defaultGeometry;
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
    sourcePort,
    targetPort,
    dir,
    turn,
    inverted,
    loopIndex,
    labelAtTarget,
    labelFraction,
    labelWidth,
  ]);

  if (!geo) return null;

  const horizontalLabel =
    (dir === "rightward" || dir === "leftward") &&
    !Object.prototype.hasOwnProperty.call(customEdgeTypes ?? {}, edgeType) &&
    !(
      propertyMode &&
      (sourceY !== undefined ||
        targetY !== undefined ||
        sourcePort ||
        targetPort)
    );
  const labelTransform = horizontalLabel
    ? `translate(${geo.label.x} ${geo.label.y - labelHeight / 2 - 2 * LABEL_PADDING})`
    : `translate(${geo.label.x} ${geo.label.y}) rotate(${geo.label.angle}) translate(${dir === "downward" || dir === "upward" || labelAtTarget || Object.prototype.hasOwnProperty.call(customEdgeTypes ?? {}, edgeType) ? 0 : LABEL_MARGIN_X} 0)`;

  const validationColor = validationIssue?.startsWith("Unverified:")
    ? "#b45309"
    : "#dc2626";
  const displayColor = validationIssue ? validationColor : color;
  const validationEl = validationIssue ? (
    <g
      className="flow-sdk-edge-validation"
      role="img"
      aria-label={validationIssue}
      transform={`translate(${geo.label.x} ${geo.label.y - (lines.length * labelFontSize) / 2 - 55})`}
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

  const trace = animated && edgeData?.edgeAnimationVariant === "traveling";
  const dashArray = !trace && (dashed || animated) ? DASH_PATTERN : undefined;
  const animClass =
    animated && !trace
      ? `flow-sdk-edge-anim${inverted ? " flow-sdk-edge-anim-rev" : ""}`
      : undefined;

  let labelEl: React.ReactNode = null;
  const revealStyle = reveal
    ? ({
        "--flow-edge-reveal-duration": `${reveal.durationMs ?? 600}ms`,
        "--flow-edge-reveal-state": reveal.paused ? "paused" : "running",
      } as React.CSSProperties)
    : undefined;
  if (lines.length || icon) {
    const w = labelWidth;
    const h = labelHeight;
    labelEl = (
      <g
        className={`flow-sdk-edge-label${reveal ? " flow-sdk-edge-reveal-end" : ""}`}
        style={revealStyle}
        data-label-transform={labelTransform}
        data-label-horizontal={horizontalLabel || undefined}
        data-edge-id={id}
        data-source-property={sourceProperty}
        data-target-property={targetProperty}
        transform={labelTransform}
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
          fontSize={labelFontSize}
          style={{
            fontSize: labelFontSize,
            fontFamily: EDGE_LABEL_FONT_FAMILY,
          }}
          fontFamily={EDGE_LABEL_FONT_FAMILY}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {lines.map((l, i) => (
            <tspan
              key={i}
              x={iconWidth / 2}
              y={(i - (lines.length - 1) / 2) * labelFontSize}
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

  const stroke = (
    <>
      <path
        d={geo.d}
        fill="none"
        stroke={displayColor}
        strokeWidth={EDGE_WIDTH}
        strokeOpacity={trace ? 0.35 : undefined}
        strokeDasharray={dashArray}
        className={animClass}
      />
      {trace && (
        <EdgeTraceAnimation
          path={geo.d}
          color={displayColor}
          width={EDGE_WIDTH * 1.6}
          reversed={inverted}
        />
      )}
    </>
  );

  return (
    <g
      className="flow-sdk-edge"
      style={revealStyle}
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
      {reveal ? (
        <EdgeReveal
          path={geo.d}
          width={EDGE_WIDTH * 4}
          reversed={inverted}
          onComplete={() => onRevealComplete?.(id)}
        >
          {stroke}
        </EdgeReveal>
      ) : (
        stroke
      )}
      {geo.arrow && (
        <path
          className={reveal ? "flow-sdk-edge-reveal-end" : undefined}
          d={geo.arrow}
          fill={
            validationIssue ? validationColor : (connectorColor ?? displayColor)
          }
        />
      )}
      {labelLayer && labelEl ? createPortal(labelEl, labelLayer) : labelEl}
      {labelLayer && validationEl
        ? createPortal(validationEl, labelLayer)
        : validationEl}
      <path
        className="flow-sdk-edge-hit"
        d={geo.d}
        fill="none"
        stroke="transparent"
      />
    </g>
  );
}

export default memo(EdgeView);
