import { memo, useLayoutEffect, useRef, useState } from "react";
import { PiPlusBold } from "react-icons/pi";
import type { FlowDirection } from "../types";
import { NodeBorderAnimation } from "./NodeBorderAnimation";
import { measureNodeSurface, type NodeSurface } from "./nodeSurface";
import { measurePropertyRows, type PropertyRow } from "./propertyRows";

export interface NodeHostProps {
  id: string;
  x: number;
  y: number;
  /** Positioned by a layout run; hidden (but measurable) before that */
  placed: boolean;
  hidden?: boolean;
  /** Register/unregister the host element for size observation */
  onMount: (id: string, el: HTMLDivElement | null) => void;
  drawHandles?: boolean;
  drawMode?: boolean;
  connectedPorts?: ReadonlySet<string>;
  resolvedRows?: PropertyRow[];
  hasCollapseControl?: boolean;
  handleColor?: string;
  animated?: boolean;
  animationColor?: string;
  animationWidth?: number;
  width?: number;
  height?: number;
  propertyMode?: boolean;
  reversePorts?: boolean;
  direction?: FlowDirection;
  onPropertyRows?: (id: string, rows: PropertyRow[]) => void;
  onSurface?: (id: string, surface: NodeSurface | undefined) => void;
  children?: React.ReactNode;
}

function NodeHost({
  id,
  x,
  y,
  placed,
  hidden,
  onMount,
  drawHandles,
  drawMode,
  connectedPorts,
  resolvedRows,
  hasCollapseControl,
  handleColor,
  animated,
  animationColor,
  animationWidth = 8,
  width = 0,
  height = 0,
  propertyMode,
  reversePorts,
  direction = "LR",
  onPropertyRows,
  onSurface,
  children,
}: NodeHostProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [measuredRows, setRows] = useState<PropertyRow[]>([]);
  const rows = resolvedRows ?? measuredRows;
  const [surface, setSurface] = useState<NodeSurface>();

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const measure = () => {
      const next = measureNodeSurface(host);
      setSurface((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
      onSurface?.(id, next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    const shape = host.querySelector("[data-flow-node-surface]");
    if (shape) observer.observe(shape);
    return () => observer.disconnect();
  }, [id, children, onSurface]);

  useLayoutEffect(() => {
    onMount(id, ref.current);
    return () => {
      onMount(id, null);
      onSurface?.(id, undefined);
    };
  }, [id, onMount, onSurface]);

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    let previous = "";
    const measure = () => {
      const measured = measurePropertyRows(host);
      const next = propertyMode
        ? measured
        : measured.filter((row) => row.anchor);
      const key = JSON.stringify(next);
      if (key === previous) return;
      previous = key;
      setRows(next);
      onPropertyRows?.(id, next);
    };
    measure();
    if (!propertyMode && !host.querySelector("[data-flow-port-side]")) return;
    const resize = new ResizeObserver(measure);
    const observeRows = () => {
      resize.disconnect();
      resize.observe(host);
      host
        .querySelectorAll("[data-flow-property]")
        .forEach((element) => resize.observe(element));
      measure();
    };
    observeRows();
    const mutations = new MutationObserver(observeRows);
    mutations.observe(host, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "data-flow-property",
        "data-flow-port-role",
        "data-flow-port-side",
        "data-flow-port-position",
        "data-flow-port-placement",
      ],
    });
    host.addEventListener("scroll", measure, true);
    return () => {
      resize.disconnect();
      mutations.disconnect();
      host.removeEventListener("scroll", measure, true);
    };
  }, [id, propertyMode, onPropertyRows, children]);

  return (
    <div
      ref={ref}
      className="flow-sdk-node"
      data-node-id={id}
      style={{
        transform: `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
        visibility: placed && !hidden ? undefined : "hidden",
      }}
    >
      {children}
      {animated && animationWidth > 0 && width > 0 && height > 0 && (
        <svg
          className="flow-sdk-node-animation"
          aria-hidden="true"
          pointerEvents="none"
        >
          <NodeBorderAnimation
            x={(surface?.left ?? 0) + animationWidth / 2}
            y={(surface?.top ?? 0) + animationWidth / 2}
            width={(surface?.width ?? width) - animationWidth}
            height={(surface?.height ?? height) - animationWidth}
            radius={(surface?.radius ?? 0) - animationWidth / 2}
            path={
              surface?.outline
                ? `M${surface.outline.map((point) => `${point.x} ${point.y}`).join(" L")} Z`
                : undefined
            }
            color={animationColor || handleColor || "currentColor"}
            strokeWidth={animationWidth}
          />
        </svg>
      )}
      {drawHandles &&
        propertyMode &&
        rows.map((row) =>
          (["source", "target"] as const)
            .filter((role) => !row.role || row.role === role)
            .filter(
              (role) =>
                drawMode || connectedPorts?.has(`${role}:${row.property}`),
            )
            .map((role) => (
              <button
                key={`${row.property}:${role}`}
                type="button"
                className="flow-sdk-property-port"
                data-property={row.property}
                data-port-role={role}
                data-port-side={row.anchor?.side}
                aria-label={`${role === "source" ? "Connect" : "Input"} ${row.property}`}
                title={`${role === "source" ? "Connect" : "Input"} ${row.property}`}
                style={{
                  color: handleColor,
                  ...(row.anchor
                    ? { top: row.anchor.y, left: row.anchor.x - 16 }
                    : {
                        top: row.top + row.height / 2,
                        [(role === "source") !== !!reversePorts
                          ? "right"
                          : "left"]: -16,
                      }),
                }}
                onClick={(event) => event.stopPropagation()}
              />
            )),
        )}
      {drawHandles &&
        !hasCollapseControl &&
        (!propertyMode || !rows.length) &&
        (!propertyMode || !rows.some((row) => row.anchor)) && (
          <button
            type="button"
            className="flow-sdk-handle"
            aria-label="Draw edge"
            title="Draw edge"
            style={{
              color: handleColor,
              left:
                (surface?.left ?? 0) +
                (direction === "RL"
                  ? -36
                  : direction === "LR"
                    ? (surface?.width ?? width)
                    : (surface?.width ?? width) / 2),
              top:
                (surface?.top ?? 0) +
                (direction === "BT"
                  ? -36
                  : direction === "TB"
                    ? (surface?.height ?? height)
                    : (surface?.height ?? height) / 2),
              transform:
                direction === "BT" || direction === "TB"
                  ? "translateX(-50%)"
                  : "translateY(-50%)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <PiPlusBold size={24} />
          </button>
        )}
    </div>
  );
}

export default memo(NodeHost);
