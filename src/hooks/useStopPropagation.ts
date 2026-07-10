import { useEffect, useRef } from "react";

/**
 * Hook that stops all event propagation on a DOM element.
 * Use this on any interactive element inside a node (inputs, textareas, forms)
 * to prevent cytoscape from intercepting mouse/keyboard events.
 *
 * @param active - Only attach listeners when true (e.g. when editing)
 * @returns ref to attach to the wrapper element
 *
 * @example
 * const inputRef = useStopPropagation<HTMLDivElement>(isEditing);
 * return <div ref={inputRef}><input /></div>;
 */
export function useStopPropagation<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const stopProp = (e: Event) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const el = ref.current;
    const events = ["mousedown", "mouseup", "click", "pointerdown", "pointerup", "keydown", "keyup", "keypress", "input", "focus"];
    events.forEach((evt) => el.addEventListener(evt, stopProp, true));
    return () => {
      events.forEach((evt) => el.removeEventListener(evt, stopProp, true));
    };
  }, [active]);

  return ref;
}
