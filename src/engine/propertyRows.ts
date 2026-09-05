import { shapePort } from "./geometry";
import { measureNodeSurface, surfaceBox } from "./nodeSurface";
import type { PortAnchor, PortSide } from "./types";

export interface PropertyRow {
  property: string;
  top: number;
  height: number;
  role?: "source" | "target";
  anchor?: PortAnchor;
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
  return [
    ...host.querySelectorAll<HTMLElement>("[data-flow-property]"),
  ].flatMap((element) => {
    if (element.closest(".flow-sdk-node") !== host) return [];
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
