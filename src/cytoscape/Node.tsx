import React, { useEffect, useRef } from "react";

function Node({
  cytoInstance,
  id,
  parent,
  label,
  children,
  layout,
  classes,
  styleCallback,
  parentViewProps,
}: any) {
  const domRef = useRef<HTMLDivElement>(null);
  const lastSizeRef = useRef<string>("");

  function applyStyle(node) {
    if (styleCallback && node.isParent()) {
      node.style("shape", "roundrectangle");
      node.style(styleCallback(parentViewProps));
    }
  }

  useEffect(() => {
    try {
      if (domRef.current) {
        const data: any = { id, dom: domRef.current };
        if (parent) data.parent = parent;
        if (label) data.label = label;
        const node = cytoInstance.add({ data, classes });
        applyStyle(node);
        layout();
      }
    } catch (e) {
      // silent
    }

    return () => {
      cytoInstance.getElementById(id).remove();
      layout();
    };
  }, [domRef, parent, label]);

  // Re-layout when the rendered box changes size (incl. first measurement, which
  // lands after the add-effect's layout call; the debounce coalesces them)
  useEffect(() => {
    const el = domRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const size = `${el.offsetWidth}x${el.offsetHeight}`;
      if (size === lastSizeRef.current) return;
      lastSizeRef.current = size;
      layout();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  useEffect(() => {
    if (!styleCallback) return;
    const node = cytoInstance.getElementById(id);
    if (node.length) applyStyle(node);
  }, [styleCallback, parentViewProps]);

  function newChild(c) {
    return React.cloneElement(c, { cytoInstance, layout });
  }

  const nodes = React.Children.map(children, newChild);

  return (
    <div ref={domRef} className="cytoscape-react-node">
      {nodes}
    </div>
  );
}

export default Node;
