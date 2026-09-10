import { useLayoutEffect, useRef, useState } from "react";
import {
  NODE_BORDER_ANIMATION_STYLES,
  NodeBorderAnimation,
} from "../engine/NodeBorderAnimation";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import { useFlowDiagramContext } from "./FlowDiagramContext";

const styles = `${NODE_BORDER_ANIMATION_STYLES}
[data-flow-loading-border][data-flow-loading-border] .flow-sdk-node-border-animation{animation:flow-sdk-node-border 2.4s linear infinite!important}
[data-flow-loading-border][data-flow-loading-border][data-motion-disabled] .flow-sdk-node-border-animation{animation:none!important}
@media(prefers-reduced-motion:reduce){[data-flow-loading-border][data-flow-loading-border] .flow-sdk-node-border-animation{animation:none!important}}`;

export function LoadingBorder({
  active = true,
  label = "Loading content",
  radius,
}: {
  active?: boolean;
  label?: string;
  radius?: number;
}) {
  const { config, themeColor } = useFlowDiagramContext();
  const { colorText } = useCustomColors();
  const element = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, radius: 0 });
  useLayoutEffect(() => {
    const host = element.current;
    if (!active || !host) return;
    const measure = () => {
      const parent = host.parentElement;
      const next = {
        width: host.clientWidth,
        height: host.clientHeight,
        radius:
          radius ??
          (parent
            ? parseFloat(getComputedStyle(parent).borderTopLeftRadius) || 0
            : 0),
      };
      setSize((previous) =>
        previous.width === next.width &&
        previous.height === next.height &&
        previous.radius === next.radius
          ? previous
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    measure();
    return () => observer.disconnect();
  }, [active, radius]);
  if (!active) return null;
  const color = getChakraColorHex(themeColor || colorText);
  const geometry = {
    x: 4,
    y: 4,
    width: size.width - 8,
    height: size.height - 8,
    radius: Math.max(0, size.radius - 4),
    color,
    strokeWidth: 2,
  };
  return (
    <div
      ref={element}
      role="status"
      aria-label={label}
      data-flow-loading-border=""
      data-motion-disabled={config.disableAnimations || undefined}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        borderRadius: "inherit",
        overflow: "hidden",
        zIndex: 2,
      }}
    >
      <style>{styles}</style>
      <svg
        width="100%"
        height="100%"
        aria-hidden="true"
        style={{ display: "block", pointerEvents: "none" }}
      >
        <g opacity={0.5} style={{ filter: "blur(3px)" }}>
          <NodeBorderAnimation {...geometry} strokeWidth={6} />
        </g>
        <NodeBorderAnimation {...geometry} />
      </svg>
    </div>
  );
}
