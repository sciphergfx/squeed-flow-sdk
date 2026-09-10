import {
  memo,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  gridDraggable?: boolean;
  gridDragging?: boolean;
  gridDropTarget?: boolean;
  gridSize?: { w: number; h: number };
  gridPreview?: {
    x: number;
    y: number;
    size?: { w: number; h: number };
    floating?: boolean;
  };
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
  animationVariant?: import("../types").NodeAnimationVariant;
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
  gridDraggable,
  gridDragging,
  gridDropTarget,
  gridSize,
  gridPreview,
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
  animationVariant,
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
  const previewId = useId();
  const previewRef = useRef<HTMLDivElement>();
  const hasGridPreview = !!gridPreview;
  const floatingPreview = !!gridPreview?.floating;

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host || !hasGridPreview) return;
    const preview = host.cloneNode(true) as HTMLDivElement;
    preview.removeAttribute("data-node-id");
    preview.removeAttribute("data-grid-dragging");
    preview.removeAttribute("data-grid-draggable");
    preview.removeAttribute("data-grid-drop-target");
    preview.setAttribute("data-grid-preview", id);
    preview.setAttribute("aria-hidden", "true");
    preview.setAttribute("inert", "");
    const elements = [preview, ...preview.querySelectorAll("*")];
    const identifiers = new Map(
      elements
        .filter((element) => element.id)
        .map((element) => [element.id, `${element.id}-${previewId}`]),
    );
    for (const element of elements) {
      if (element.id) element.id = identifiers.get(element.id)!;
      for (const attribute of [...element.attributes]) {
        if (attribute.name === "id") continue;
        let value = attribute.value;
        for (const [original, replacement] of identifiers) {
          if (value === `#${original}`) value = `#${replacement}`;
          value = value.split(`url(#${original})`).join(`url(#${replacement})`);
        }
        if (value !== attribute.value)
          element.setAttribute(attribute.name, value);
      }
    }
    Object.assign(preview.style, {
      opacity: "0.35",
      zIndex: floatingPreview ? "2147483647" : "11",
      pointerEvents: "none",
      outline: "none",
      visibility: "visible",
    });
    if (floatingPreview) {
      const style = getComputedStyle(host);
      preview.setAttribute("data-grid-preview-floating", "");
      Object.assign(preview.style, {
        position: "fixed",
        left: "0",
        top: "0",
        transformOrigin: "top left",
        font: style.font,
        color: style.color,
      });
      for (const element of elements) {
        element.removeAttribute("data-node-id");
        (element as HTMLElement).style.pointerEvents = "none";
      }
    }
    preview
      .querySelectorAll(
        ".flow-sdk-node-animation, .flow-sdk-handle, .flow-sdk-property-port, [data-flow-collapse-control]",
      )
      .forEach((element) => element.remove());
    (floatingPreview ? document.body : host.parentElement)?.appendChild(
      preview,
    );
    previewRef.current = preview;
    return () => {
      preview.remove();
      previewRef.current = undefined;
    };
  }, [id, previewId, hasGridPreview, floatingPreview]);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview || !gridPreview) return;
    const { x: centerX, y: centerY, size } = gridPreview;
    if (floatingPreview && ref.current) {
      const host = ref.current;
      const bounds = host.getBoundingClientRect();
      const scaleX = bounds.width / host.offsetWidth || 1;
      const scaleY = bounds.height / host.offsetHeight || 1;
      const left = bounds.left + (centerX - x) * scaleX;
      const top = bounds.top + (centerY - y) * scaleY;
      preview.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${scaleX}, ${scaleY})`;
      preview.style.width = `${host.offsetWidth}px`;
      preview.style.height = `${host.offsetHeight}px`;
      return;
    }
    const left = size ? Math.round(centerX - size.w / 2) : centerX;
    const top = size ? Math.round(centerY - size.h / 2) : centerY;
    preview.style.transform = size
      ? `translate3d(${left}px, ${top}px, 0)`
      : `translate(-50%, -50%) translate3d(${left}px, ${top}px, 0)`;
    preview.style.width = size
      ? `${Math.round(centerX + size.w / 2) - left}px`
      : "";
    preview.style.height = size
      ? `${Math.round(centerY + size.h / 2) - top}px`
      : "";
    if (size) {
      preview.style.setProperty("--flow-grid-width", `${size.w}px`);
      preview.style.setProperty("--flow-grid-height", `${size.h}px`);
      preview.style.setProperty(
        "--flow-grid-font",
        `${Math.max(12, Math.min(48, size.w / 8, size.h / 5))}px`,
      );
    }
  }, [
    gridPreview?.x,
    gridPreview?.y,
    gridPreview?.size?.w,
    gridPreview?.size?.h,
    floatingPreview,
    x,
    y,
  ]);

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

  const gridLeft = gridSize ? Math.round(x - gridSize.w / 2) : 0;
  const gridTop = gridSize ? Math.round(y - gridSize.h / 2) : 0;
  const gridWidth = gridSize
    ? Math.round(x + gridSize.w / 2) - gridLeft
    : undefined;
  const gridHeight = gridSize
    ? Math.round(y + gridSize.h / 2) - gridTop
    : undefined;

  return (
    <div
      ref={ref}
      className="flow-sdk-node"
      data-node-id={id}
      data-grid-draggable={gridDraggable || undefined}
      data-grid-dragging={gridDragging || undefined}
      data-grid-drop-target={gridDropTarget || undefined}
      data-grid-fill={gridSize ? "" : undefined}
      style={
        {
          transform: gridSize
            ? `translate3d(${gridLeft}px, ${gridTop}px, 0)`
            : `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
          visibility: placed && !hidden ? undefined : "hidden",
          cursor: gridDraggable
            ? gridDragging
              ? "grabbing"
              : "grab"
            : undefined,
          zIndex: gridDragging ? 12 : undefined,
          opacity: gridPreview ? 0 : gridDragging ? 0.75 : undefined,
          outline: gridDropTarget
            ? `2px solid ${handleColor || "currentColor"}`
            : undefined,
          outlineOffset: gridDropTarget ? 8 : undefined,
          width: gridWidth,
          height: gridHeight,
          ...(gridSize
            ? {
                "--flow-grid-width": `${gridSize.w}px`,
                "--flow-grid-height": `${gridSize.h}px`,
                "--flow-grid-font": `${Math.max(12, Math.min(48, gridSize.w / 8, gridSize.h / 5))}px`,
              }
            : {}),
        } as CSSProperties
      }
    >
      {children}
      {!gridSize &&
        animated &&
        animationWidth > 0 &&
        width > 0 &&
        height > 0 && (
          <svg
            className="flow-sdk-node-animation"
            aria-hidden="true"
            pointerEvents="none"
          >
            <NodeBorderAnimation
              variant={animationVariant}
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
