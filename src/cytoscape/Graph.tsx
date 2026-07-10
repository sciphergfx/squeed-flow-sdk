import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cytoscape } from "./setupCytoscape";
import lodash from "lodash";

interface GraphProps {
  cyParams: any;
  cyInst?: any;
  layoutParams: any;
  layoutDebounce?: number;
  children?: React.ReactNode;
  init?: (cy: any) => void;
  onCyInit?: (cy: any) => void;
}

function Graph({
  cyParams,
  cyInst,
  layoutParams,
  layoutDebounce = 50,
  children,
  init = () => {},
  onCyInit,
}: GraphProps) {
  const [ready, setReady] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);
  const cytoscapeRef = useRef<any>(null);
  const layoutRef = useRef<any>(null);
  const isInitialLayoutRef = useRef(true);

  const runLayout = useCallback(() => {
    if (layoutRef.current !== null) {
      layoutRef.current.stop();
    }
    if (cytoscapeRef.current) {
      layoutRef.current = cytoscapeRef.current.layout(layoutParams);
      layoutRef.current?.run();
    }
  }, [layoutParams]);

  const debouncedRunLayout = lodash.debounce(runLayout, layoutDebounce);

  useEffect(() => {
    if (!domRef.current) return;

    const cy = cytoscape({
      container: domRef.current,
      ...cyParams,
    });

    const domContainer = domRef.current.querySelector(".cytoscape-react-nodes-and-edges");
    if (domContainer) {
      (cy as any).domNode({ dom_container: domContainer });
    }

    cytoscapeRef.current = cyInst || cy;

    if (domRef.current) {
      (domRef.current as any).cy = cytoscapeRef.current;
    }

    onCyInit?.(cytoscapeRef.current);
    init(cy);

    if (domRef.current && cytoscapeRef.current) {
      const parentElement = domRef.current.parentElement;
      let targetHeight = 0;
      let targetWidth = 0;

      if (parentElement) {
        targetHeight = parentElement.clientHeight;
        targetWidth = parentElement.clientWidth;

        if (targetHeight === 0) {
          targetHeight = window.innerHeight - parentElement.getBoundingClientRect().top - 100;
        }
        if (targetWidth === 0) {
          targetWidth = window.innerWidth;
        }
      }

      if (targetHeight > 0 && targetWidth > 0) {
        domRef.current.style.width = `${targetWidth}px`;
        domRef.current.style.height = `${targetHeight}px`;
      }

      cytoscapeRef.current.resize();
      if (cyParams.zoom && cyParams.pan) {
        cytoscapeRef.current.viewport({ zoom: cyParams.zoom, pan: cyParams.pan });
      }
    }

    setReady(true);

    const resizeObserver = new ResizeObserver(
      lodash.debounce(() => {
        if (domRef.current && cytoscapeRef.current) {
          const parentElement = domRef.current.parentElement;
          let targetHeight = 0;
          let targetWidth = 0;

          if (parentElement) {
            targetHeight = parentElement.clientHeight;
            targetWidth = parentElement.clientWidth;

            if (targetHeight === 0) {
              targetHeight = window.innerHeight - parentElement.getBoundingClientRect().top - 100;
            }
            if (targetWidth === 0) {
              targetWidth = window.innerWidth;
            }

            if (targetHeight > 0 && targetWidth > 0) {
              domRef.current.style.width = `${targetWidth}px`;
              domRef.current.style.height = `${targetHeight}px`;
            }
          }

          const currentViewport = cytoscapeRef.current.zoom() !== undefined
            ? { zoom: cytoscapeRef.current.zoom(), pan: cytoscapeRef.current.pan() }
            : null;

          cytoscapeRef.current.resize();

          if (currentViewport) {
            cytoscapeRef.current.viewport(currentViewport);
          }
        }
      }, 50),
    );

    if (domRef.current) {
      resizeObserver.observe(domRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      // Destroy cy instance so StrictMode re-invocation starts clean
      try {
        cy.destroy();
      } catch {}
      cytoscapeRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (isInitialLayoutRef.current) {
      isInitialLayoutRef.current = false;
      runLayout();
    } else {
      debouncedRunLayout();
    }
  }, [ready, layoutParams, debouncedRunLayout, runLayout]);

  const memoizedChildren = useMemo(() => {
    if (cytoscapeRef.current !== null) {
      return React.Children.map(children, (child) => {
        if (!child) return null;
        return React.cloneElement(child as React.ReactElement, {
          key: (child as React.ReactElement)?.props?.id,
          cytoInstance: cytoscapeRef.current,
          layout: debouncedRunLayout,
        });
      })?.filter(Boolean) || [];
    }
    return [];
  }, [children, ready, debouncedRunLayout]);

  return (
    <div
      ref={domRef}
      className="cytoscape-react-cy-container"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "transparent",
      }}
    >
      <div
        className="cytoscape-react-nodes-and-edges"
        style={{ pointerEvents: "none", position: "absolute", top: 0, left: 0, transformOrigin: "0 0", zIndex: 10 }}
      >
        {memoizedChildren}
      </div>
    </div>
  );
}

export default Graph;
