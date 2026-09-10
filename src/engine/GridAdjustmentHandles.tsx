import { useRef } from "react";
import { PiArrowsHorizontal, PiArrowsVertical } from "react-icons/pi";
import {
  adjustGridDivider,
  type GridDivider,
  type NodeGridOptions,
} from "./nodeCollisions";

export function GridAdjustmentHandles({
  dividers,
  options,
  zoom,
  onChange,
}: {
  dividers: GridDivider[];
  options: NodeGridOptions;
  zoom: number;
  onChange: (options: NodeGridOptions) => void;
}) {
  const drag = useRef<{
    pointerId: number;
    start: number;
    scale: number;
    divider: GridDivider;
    options: NodeGridOptions;
  }>();
  return (
    <>
      {dividers.map((divider) => {
        const horizontal = divider.axis === "x";
        const Arrow = horizontal ? PiArrowsHorizontal : PiArrowsVertical;
        const label = `${horizontal ? "Column" : "Row"} divider ${divider.index + 1}${horizontal ? ` in row ${divider.row + 1}` : ""}`;
        return (
          <button
            key={`${divider.section}:${divider.axis}:${divider.row}:${divider.index}`}
            type="button"
            role="separator"
            aria-label={label}
            aria-orientation={horizontal ? "vertical" : "horizontal"}
            aria-valuemin={5}
            aria-valuemax={95}
            aria-valuenow={Math.round(
              (100 * divider.weights[divider.index]) /
                (divider.weights[divider.index] +
                  divider.weights[divider.index + 1]),
            )}
            title={label}
            data-flow-grid-adjustment=""
            style={{
              position: "absolute",
              left: divider.position.x,
              top: divider.position.y,
              transform: "translate(-50%, -50%)",
              width: 28,
              height: 28,
              padding: 3,
              border: "1px solid currentColor",
              borderRadius: 4,
              background: "var(--chakra-colors-gray-100)",
              color: "var(--chakra-colors-gray-800)",
              display: "grid",
              placeItems: "center",
              cursor: horizontal ? "col-resize" : "row-resize",
              touchAction: "none",
              pointerEvents: "auto",
              zIndex: 30,
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              const canvas =
                event.currentTarget.closest<HTMLElement>(".flow-sdk-canvas")!;
              const bounds = canvas.getBoundingClientRect();
              drag.current = {
                pointerId: event.pointerId,
                start: horizontal ? event.clientX : event.clientY,
                scale:
                  zoom *
                  (horizontal
                    ? bounds.width / canvas.clientWidth
                    : bounds.height / canvas.clientHeight),
                divider,
                options,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const current = drag.current;
              if (!current || current.pointerId !== event.pointerId) return;
              event.preventDefault();
              event.stopPropagation();
              const delta =
                ((horizontal ? event.clientX : event.clientY) - current.start) /
                current.scale;
              onChange(
                adjustGridDivider(current.options, current.divider, delta),
              );
            }}
            onPointerUp={(event) => {
              if (!drag.current) return;
              event.stopPropagation();
              drag.current = undefined;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              if (drag.current) onChange(drag.current.options);
              drag.current = undefined;
            }}
            onLostPointerCapture={() => {
              drag.current = undefined;
            }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape" && drag.current) {
                onChange(drag.current.options);
                drag.current = undefined;
              }
              const direction = (
                horizontal
                  ? ["ArrowLeft", "ArrowRight"]
                  : ["ArrowUp", "ArrowDown"]
              ).indexOf(event.key);
              if (direction < 0) return;
              event.preventDefault();
              event.stopPropagation();
              onChange(
                adjustGridDivider(
                  options,
                  divider,
                  divider.length *
                    (event.shiftKey ? 0.1 : 0.02) *
                    (direction === 0 ? -1 : 1),
                ),
              );
            }}
          >
            <Arrow size={20} aria-hidden="true" />
          </button>
        );
      })}
    </>
  );
}
