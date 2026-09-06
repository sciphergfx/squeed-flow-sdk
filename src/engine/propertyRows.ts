import { shapePort } from "./geometry";
import { measureNodeSurface, surfaceBox } from "./nodeSurface";
import type { PortAnchor, PortSide } from "./types";

export interface PropertyRow {
  property: string;
  top: number;
  height: number;
  role?: "source" | "target";
  anchor?: PortAnchor;
  placement?: "config";
}

export function measurePropertyRows(host: HTMLElement): PropertyRow[] {
  const bounds = host.getBoundingClientRect();
  const scale = bounds.height / host.offsetHeight;
  if (!Number.isFinite(scale) || scale <= 0) return [];
  const surface = measureNodeSurface(host);
  const box = {
    x: host.offsetWidth / 2,
    y: host.offsetHeight / 2,
    w: host.offsetWidth,
    h: host.offsetHeight,
  };
  const elements = [...host.querySelectorAll<HTMLElement>("[data-flow-property]")];
  const inspectionIds = new Set(elements.filter(element => element.hasAttribute("data-flow-inspection-row") && element.getBoundingClientRect().height > 0)
    .map(element => element.dataset.flowProperty));
  return elements.flatMap((element) => {
    if (element.closest(".flow-sdk-node") !== host) return [];
    if (inspectionIds.has(element.dataset.flowProperty) && !element.hasAttribute("data-flow-inspection-row")) return [];
    const side = element.dataset.flowPortSide;
    if (side && ["top", "right", "bottom", "left"].includes(side)) {
      const anchor = shapePort(
        surface ? surfaceBox(box, surface) : box,
        side as PortSide,
        Number(element.dataset.flowPortPosition ?? 0.5),
      );
      return [
        {
          property: element.getAttribute("data-flow-property")!,
          top: anchor.y,
          height: 0,
          anchor,
          ...(element.dataset.flowPortPlacement === "config" ? { placement: "config" as const } : {}),
          ...(element.dataset.flowPortRole === "source" ||
          element.dataset.flowPortRole === "target"
            ? { role: element.dataset.flowPortRole }
            : {}),
        },
      ];
    }
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    return [
      {
        property: element.getAttribute("data-flow-property")!,
        top: Math.round(((rect.top - bounds.top) / scale) * 1000) / 1000,
        height: Math.round((rect.height / scale) * 1000) / 1000,
        ...(element.dataset.flowPortRole === "source" ||
        element.dataset.flowPortRole === "target"
          ? { role: element.dataset.flowPortRole }
          : {}),
      },
    ];
  });
}
