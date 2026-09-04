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
    // React 17+ delegates from the root, so stopping an event on any ancestor kills React's
    // handlers for it. Keyboard/input/focus are therefore left alone (FlowView's window keydown
    // handler already ignores INPUT/TEXTAREA targets); only pointer events are contained.
    const stopProp = (e: Event) => {
      e.stopPropagation();
    };
    const el = ref.current;
    const events = [
      "mousedown",
      "mouseup",
      "click",
      "dblclick",
      "pointerdown",
      "pointerup",
      "wheel",
    ];
    events.forEach((evt) => el.addEventListener(evt, stopProp));
    return () => {
      events.forEach((evt) => el.removeEventListener(evt, stopProp));
    };
  }, [active]);

  return ref;
}
