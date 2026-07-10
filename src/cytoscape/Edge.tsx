import React, { useCallback, useEffect, useRef, useState } from "react";
import { calculateEdgeControlPoints } from "../core/layoutCalculations";

function Edge({ cytoInstance, id, source, type, target, label, children, layout, styleCallback, isPerformanceMode }: any) {
  const domRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const [missing, setMissing] = useState(2);
  let animated: boolean, inverted: boolean;

  function applyStyle(edge) {
    if (styleCallback) {
      const style = styleCallback(edge, source, target);
      animated = style.hasOwnProperty("line-style");
      inverted = style.hasOwnProperty("source-arrow-shape");
      edge.style(style);
    }
  }

  const animateDashedEdge = useCallback(() => {
    if (!animated || isPerformanceMode) return;

    const edge = cytoInstance.getElementById(id);
    if (edge.length === 0) return;

    const now = Date.now();
    const totalDashLength = 20;
    const animationSpeed = 0.1;
    const offsetBase = (now * animationSpeed) % (totalDashLength * 50);
    const offset = !inverted ? -offsetBase : offsetBase;

    edge.style("line-dash-offset", offset);
    animationRef.current = requestAnimationFrame(animateDashedEdge);
  }, [animated, cytoInstance, id, inverted, isPerformanceMode]);

  function addEdge(cyEdgeData) {
    const controlPoints = calculateEdgeControlPoints(cytoInstance, source, target, id);
    const edge = cytoInstance.add({
      data: {
        ...cyEdgeData,
        controlPointDistances: controlPoints.controlPointDistances,
        controlPointWeights: controlPoints.controlPointWeights,
      },
    });
    applyStyle(edge);
    if (animated) {
      animationRef.current = requestAnimationFrame(animateDashedEdge);
    }
  }

  function missingNodeCount(source2, target2) {
    let missingCount = 2;
    if (cytoInstance.getElementById(source2).length === 1) missingCount -= 1;
    if (cytoInstance.getElementById(target2).length === 1) missingCount -= 1;
    return missingCount;
  }

  useEffect(() => {
    const nowMissing = missingNodeCount(source, target);
    if (nowMissing === 0) {
      const existingEdge = cytoInstance.getElementById(id);
      if (existingEdge.length === 0) {
        const controlPoints = calculateEdgeControlPoints(cytoInstance, source, target, id);
        const edge = cytoInstance.add({
          data: {
            id, source, target, label, type,
            controlPointDistances: controlPoints.controlPointDistances,
            controlPointWeights: controlPoints.controlPointWeights,
          },
        });
        applyStyle(edge);
        if (animated) {
          animationRef.current = requestAnimationFrame(animateDashedEdge);
        }
      } else {
        const controlPoints = calculateEdgeControlPoints(cytoInstance, source, target, id);
        existingEdge.data({
          source, target, label, type,
          controlPointDistances: controlPoints.controlPointDistances,
          controlPointWeights: controlPoints.controlPointWeights,
        });
        applyStyle(existingEdge);
      }
    }
  }, [source, target, id, label, type, cytoInstance, animated, animateDashedEdge]);

  useEffect(() => {
    function onAddNode(ev) {
      const evId = ev.target.id();
      if (evId === source || evId === target) {
        const postEvMissing = missingNodeCount(source, target);
        if (postEvMissing !== missing) setMissing(postEvMissing);
        if (postEvMissing === 0) addEdge({ id, source, target, label, type });
      }
    }

    function onRemoveNode(ev) {
      const evId = ev.target.id();
      if (evId === source || evId === target) {
        const postEvMissing = missingNodeCount(source, target);
        if (postEvMissing !== missing) setMissing(postEvMissing);
        if (postEvMissing > 0) {
          cytoInstance.getElementById(id).remove();
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }
      }
    }

    cytoInstance.on("add", "node", onAddNode);
    cytoInstance.on("remove", "node", onRemoveNode);

    if (animated && missing === 0) {
      animationRef.current = requestAnimationFrame(animateDashedEdge);
    }

    return () => {
      cytoInstance.getElementById(id).remove();
      cytoInstance.off("add", "node", onAddNode);
      cytoInstance.off("remove", "node", onRemoveNode);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (animated && missing === 0) {
      if (!animationRef.current) {
        animationRef.current = requestAnimationFrame(animateDashedEdge);
      }
    } else if (!animated && animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [animated, missing, animateDashedEdge]);

  useEffect(() => { layout(); }, [id, children]);

  useEffect(() => {
    if (!missing) {
      const edge = cytoInstance.getElementById(id);
      applyStyle(edge);
    }
  }, [styleCallback, missing]);

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
