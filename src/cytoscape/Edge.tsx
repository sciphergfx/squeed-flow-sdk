import React, { useEffect, useRef, useState } from "react";
import { setEdgeAnimation } from "./edgeAnimator";

function missingNodeCount(cy, source, target) {
  let missing = 2;
  if (cy.getElementById(source).length === 1) missing -= 1;
  if (cy.getElementById(target).length === 1) missing -= 1;
  return missing;
}

function Edge({
  cytoInstance,
  id,
  source,
  type,
  target,
  label,
  children,
  layout,
  styleCallback,
  isPerformanceMode,
  animated = false,
  inverted = false,
  edgeData,
}: any) {
  const domRef = useRef<HTMLDivElement>(null);
  // stable identity for the shared animator registry
  const animKey = useRef({});
  const [missing, setMissing] = useState(2);

  function applyStyle(edge) {
    if (styleCallback)
      edge.style(styleCallback(edge, source, target, edgeData));
  }

  function syncEdge() {
    const existing = cytoInstance.getElementById(id);
    if (existing.length === 0) {
      applyStyle(
        cytoInstance.add({ data: { id, source, target, label, type } }),
      );
      layout();
    } else {
      existing.data({ source, target, label, type });
      applyStyle(existing);
    }
  }

  useEffect(() => {
    const now = missingNodeCount(cytoInstance, source, target);
    setMissing(now);
    if (now === 0) syncEdge();
  }, [source, target, id, label, type, cytoInstance]);

  useEffect(() => {
    function onAddNode(ev) {
      const evId = ev.target.id();
      if (evId !== source && evId !== target) return;
      const now = missingNodeCount(cytoInstance, source, target);
      setMissing(now);
      if (now === 0) syncEdge();
    }

    function onRemoveNode(ev) {
      const evId = ev.target.id();
      if (evId !== source && evId !== target) return;
      const now = missingNodeCount(cytoInstance, source, target);
      setMissing(now);
      if (now > 0 && cytoInstance.getElementById(id).length) {
        cytoInstance.getElementById(id).remove();
        layout();
      }
    }

    cytoInstance.on("add", "node", onAddNode);
    cytoInstance.on("remove", "node", onRemoveNode);

    return () => {
      cytoInstance.off("add", "node", onAddNode);
      cytoInstance.off("remove", "node", onRemoveNode);
      setEdgeAnimation(animKey.current, null);
      if (cytoInstance.getElementById(id).length) {
        cytoInstance.getElementById(id).remove();
        layout();
      }
    };
  }, []);

  useEffect(() => {
    const edge = cytoInstance.getElementById(id);
    const on =
      animated && !isPerformanceMode && missing === 0 && edge.length > 0;
    setEdgeAnimation(animKey.current, on ? edge : null, inverted);
  }, [animated, inverted, isPerformanceMode, missing, cytoInstance, id]);

  useEffect(() => {
    if (missing) return;
    const edge = cytoInstance.getElementById(id);
    if (edge.length) applyStyle(edge);
  }, [styleCallback, edgeData, missing]);

  if (missing > 0) return null;

  function newChild(c) {
    return React.cloneElement(c, { cytoInstance, layout });
  }

  const edges = React.Children.map(children, newChild);

  return (
    <div ref={domRef} className="cytoscape-react-edge">
      {edges}
    </div>
  );
}

export default Edge;
