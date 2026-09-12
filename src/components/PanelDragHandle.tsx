import { chakra } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { PiDotsSix } from "react-icons/pi";
import { useCustomColors } from "../theme/useCustomColors";

export function PanelDragHandle({ label, disabled = false }: { label: string; disabled?: boolean }) {
  const handle = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number }>();
  const { colorInactive } = useCustomColors();
  const panel = () => handle.current?.closest<HTMLElement>("[data-flow-floating-panel]");
  const move = (left: number, top: number) => {
    const element = panel();
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    element.style.left = `${Math.max(12, Math.min(left, window.innerWidth - bounds.width - 12))}px`;
    element.style.top = `${Math.max(12, Math.min(top, window.innerHeight - bounds.height - 12))}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
    element.dataset.flowPanelMoved = "true";
  };
  const end = (cancelled = false) => {
    const current = drag.current;
    if (!current) return;
    if (cancelled) move(current.left, current.top);
    drag.current = undefined;
    if (handle.current?.hasPointerCapture(current.pointerId)) handle.current.releasePointerCapture(current.pointerId);
    if (handle.current) handle.current.style.cursor = "";
  };
  useEffect(() => {
    const resize = () => {
      const element = panel();
      if (!element?.dataset.flowPanelMoved) return;
      const bounds = element.getBoundingClientRect();
      move(bounds.left, bounds.top);
    };
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !drag.current) return;
      event.preventDefault();
      event.stopPropagation();
      end(true);
    };
    const blur = () => end(true);
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", cancel, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", cancel, true);
      window.removeEventListener("blur", blur);
      end();
    };
  }, []);
  return (
    <chakra.button
      ref={handle}
      type="button"
      aria-label={`Drag ${label}`}
      title={disabled ? "Pin to drag" : `Drag ${label}`}
      disabled={disabled}
      data-panel-drag-handle=""
      display="flex"
      alignItems="center"
      justifyContent="center"
      width="64px"
      height="24px"
      flexShrink={0}
      marginInline="auto"
      border={0}
      background="transparent"
      color={colorInactive}
      cursor="grab"
      touchAction="none"
      userSelect="none"
      _disabled={{ opacity: 0.35, cursor: "default" }}
      onPointerDown={(event) => {
        if (event.button !== 0 || drag.current) return;
        const bounds = panel()?.getBoundingClientRect();
        if (!bounds) return;
        event.preventDefault();
        event.stopPropagation();
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.style.cursor = "grabbing";
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        event.stopPropagation();
        move(current.left + event.clientX - current.x, current.top + event.clientY - current.y);
      }}
      onPointerUp={(event) => { if (drag.current?.pointerId === event.pointerId) end(); }}
      onPointerCancel={() => end(true)}
      onLostPointerCapture={() => end()}
      onKeyDown={(event) => {
        const bounds = panel()?.getBoundingClientRect();
        if (!bounds || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? 40 : 10;
        move(bounds.left + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
          bounds.top + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0));
      }}
    >
      <PiDotsSix size={20} aria-hidden="true" />
    </chakra.button>
  );
}