import React, { useEffect, useRef } from "react";

function Node({ cytoInstance, id, parent, label, children, layout, classes, styleCallback }: any) {
  const domRef = useRef<HTMLDivElement>(null);

  function applyStyle(node) {
    if (styleCallback) {
      const style = styleCallback(node);
      if (node.isParent()) {
        node.style("shape", "roundrectangle");
        node.style(style);
      }
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
      }
    } catch (e) {
      // silent
    }

    return () => {
      cytoInstance.getElementById(id).remove();
    };
  }, [domRef, parent, label]);

  useEffect(() => {
    layout();
    const node = cytoInstance.getElementById(id);
    if (node && node.isParent()) {
      applyStyle(node);
    }
  }, [id, children]);

  useEffect(() => {
    if (!styleCallback) return;
    const node = cytoInstance.getElementById(id);
    if (node && node.isParent()) {
      applyStyle(node);
    }
  }, [styleCallback]);

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
