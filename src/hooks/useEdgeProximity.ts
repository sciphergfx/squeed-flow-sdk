import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True while the pointer is within `threshold` px of one edge of `bounds`, or over any `inside`
 * element. Used to reveal hidden edge toolbars; inactive when disabled or the pointer leaves the page.
 */
export function useEdgeProximity({
  edge,
  enabled,
  bounds,
  inside = [],
  threshold = 80,
}: {
  edge: "top" | "bottom";
  enabled: boolean;
  bounds: RefObject<HTMLElement | null>;
  inside?: RefObject<HTMLElement | null>[];
  threshold?: number;
}) {
  const [near, setNear] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const insideRef = useRef(inside);
  insideRef.current = inside;
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const overlays = document.querySelectorAll<HTMLElement>(
        ':popover-open, dialog[open], [role="dialog"], [role="menu"], [role="listbox"]',
      );
      setOverlayOpen(
        Array.from(overlays).some(
          (element) =>
            element.getClientRects().length > 0 &&
            !element.closest(
              '[hidden], [aria-hidden="true"], [data-state="closed"]',
            ) &&
            getComputedStyle(element).visibility === "visible",
        ),
      );
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "hidden", "aria-hidden", "data-state"],
    });
    document.addEventListener("toggle", update, true);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("toggle", update, true);
    };
  }, [enabled]);
  useEffect(() => {
    const update = (event: PointerEvent) => {
      const rect = bounds.current?.getBoundingClientRect();
      if (!rect) return;
      const target = event.target instanceof Node ? event.target : null;
      const over =
        !!target &&
        insideRef.current.some((ref) => ref.current?.contains(target));
      const distance =
        edge === "bottom"
          ? rect.bottom - event.clientY
          : event.clientY - rect.top;
      const within =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        distance >= 0 &&
        distance <= threshold;
      setNear(over || within);
    };
    const leave = () => setNear(false);
    document.addEventListener("pointermove", update, true);
    document.addEventListener("pointerdown", update, true);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      document.removeEventListener("pointermove", update, true);
      document.removeEventListener("pointerdown", update, true);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [edge, bounds, threshold]);
  return enabled && (near || overlayOpen);
}
