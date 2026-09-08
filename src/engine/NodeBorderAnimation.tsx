import { useId, type CSSProperties } from "react";
import type { NodeAnimationVariant } from "../types";

export const NODE_BORDER_ANIMATION_STYLES = `.flow-sdk-node-animation{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:1}.flow-sdk-node-border-animation{pointer-events:none;animation:flow-sdk-node-border 2.4s linear infinite}.flow-sdk-node-border-pulse{stroke-width:var(--flow-pulse-rest-width);animation:flow-sdk-node-pulse 1.8s ease-in-out infinite}@keyframes flow-sdk-node-border{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}@keyframes flow-sdk-node-pulse{0%,100%{stroke-width:var(--flow-pulse-rest-width)}50%{stroke-width:var(--flow-pulse-expanded-width)}}@media(prefers-reduced-motion:reduce){.flow-sdk-node-border-animation{animation:none}}`;

export function NodeBorderAnimation({
  x = 0,
  y = 0,
  width,
  height,
  radius,
  color,
  strokeWidth = 8,
  path,
  variant = "traveling",
}: {
  x?: number;
  y?: number;
  width: number;
  height: number;
  radius: number;
  color: string;
  strokeWidth?: number;
  path?: string;
  variant?: NodeAnimationVariant;
}) {
  const maskId = useId();
  const className = `flow-sdk-node-border-animation${variant === "pulse" ? " flow-sdk-node-border-pulse" : ""}`;
  if (variant === "pulse") {
    const Shape = path ? "path" : "rect";
    const geometry = path
      ? { d: path }
      : {
          x,
          y,
          width: Math.max(0, width),
          height: Math.max(0, height),
          rx: Math.max(0, Math.min(radius, width / 2, height / 2)),
        };
    const extent = strokeWidth + 36;
    const bounds = {
      x: x - extent,
      y: y - extent,
      width: width + 2 * extent,
      height: height + 2 * extent,
    };
    return (
      <g aria-hidden="true" pointerEvents="none">
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            {...bounds}
            style={{ maskType: "luminance" }}
          >
            <rect {...bounds} fill="white" />
            <Shape
              {...geometry}
              fill="black"
              stroke="black"
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
          </mask>
        </defs>
        <Shape
          {...geometry}
          className={className}
          data-animation-variant={variant}
          fill="none"
          stroke={`color-mix(in srgb, ${color} 30%, transparent)`}
          strokeLinejoin="round"
          mask={`url(#${maskId})`}
          style={
            {
              "--flow-pulse-rest-width": `${strokeWidth + 16}px`,
              "--flow-pulse-expanded-width": `${strokeWidth + 36}px`,
            } as CSSProperties
          }
        />
      </g>
    );
  }
  if (path)
    return (
      <path
        className={className}
        data-animation-variant={variant}
        aria-hidden="true"
        pointerEvents="none"
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="18 82"
      />
    );
  return (
    <rect
      className={className}
      data-animation-variant={variant}
      aria-hidden="true"
      pointerEvents="none"
      x={x}
      y={y}
      width={Math.max(0, width)}
      height={Math.max(0, height)}
      rx={Math.max(0, Math.min(radius, width / 2, height / 2))}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      pathLength={100}
      strokeDasharray="18 82"
    />
  );
}
