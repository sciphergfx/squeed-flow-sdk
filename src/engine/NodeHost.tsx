import { memo, useLayoutEffect, useRef, useState } from "react";
import { PiPlusBold } from "react-icons/pi";
import { measurePropertyRows, type PropertyRow } from "./propertyRows";

export interface NodeHostProps {
  id: string;
  x: number;
  y: number;
  /** Positioned by a layout run; hidden (but measurable) before that */
  placed: boolean;
  /** Register/unregister the host element for size observation */
  onMount: (id: string, el: HTMLDivElement | null) => void;
  drawHandles?: boolean;
  handleColor?: string;
  propertyMode?: boolean;
  reversePorts?: boolean;
  onPropertyRows?: (id: string, rows: PropertyRow[]) => void;
  children?: React.ReactNode;
}

function NodeHost({
  id,
  x,
  y,
  placed,
  onMount,
  drawHandles,
  handleColor,
  propertyMode,
  reversePorts,
  onPropertyRows,
  children,
}: NodeHostProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<PropertyRow[]>([]);

  useLayoutEffect(() => {
    onMount(id, ref.current);
    return () => onMount(id, null);
  }, [id, onMount]);

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    let previous = "";
    const measure = () => {
      const next = propertyMode ? measurePropertyRows(host) : [];
      const key = JSON.stringify(next);
      if (key === previous) return;
      previous = key;
      setRows(next);
      onPropertyRows?.(id, next);
    };
    measure();
    if (!propertyMode) return;
    const resize = new ResizeObserver(measure);
    const observeRows = () => {
      resize.disconnect();
      resize.observe(host);
      host
        .querySelectorAll("[data-flow-property]")
        .forEach((element) => resize.observe(element));
      measure();
    };
    observeRows();
    const mutations = new MutationObserver(observeRows);
    mutations.observe(host, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-flow-property"],
    });
    host.addEventListener("scroll", measure, true);
    return () => {
      resize.disconnect();
      mutations.disconnect();
      host.removeEventListener("scroll", measure, true);
    };
  }, [id, propertyMode, onPropertyRows]);

  return (
    <div
      ref={ref}
      className="flow-sdk-node"
      data-node-id={id}
      style={{
        transform: `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
        visibility: placed ? undefined : "hidden",
      }}
    >
      {children}
      {drawHandles &&
        propertyMode &&
        rows.map((row) =>
          (["source", "target"] as const).map((role) => (
            <button
              key={`${row.property}:${role}`}
              type="button"
              className="flow-sdk-property-port"
              data-property={row.property}
              data-port-role={role}
              aria-label={`${role === "source" ? "Connect" : "Input"} ${row.property}`}
              title={`${role === "source" ? "Connect" : "Input"} ${row.property}`}
              style={{
                color: handleColor,
                top: row.top + row.height / 2,
                [(role === "source") !== !!reversePorts ? "right" : "left"]:
                  -16,
              }}
              onClick={(event) => event.stopPropagation()}
            />
          )),
        )}
      {drawHandles && (!propertyMode || !rows.length) && (
        <button
          type="button"
          className="flow-sdk-handle"
          aria-label="Draw edge"
          title="Draw edge"
          style={{ color: handleColor }}
          onClick={(event) => event.stopPropagation()}
        >
          <PiPlusBold size={24} />
        </button>
      )}
    </div>
  );
}

export default memo(NodeHost);
