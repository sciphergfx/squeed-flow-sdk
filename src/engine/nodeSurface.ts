import type { Box, Point } from "./types";

export interface NodeSurface {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  outline?: Point[];
}

const rounded = (value: number) => Math.round(value * 1000) / 1000;

export function measureNodeSurface(host: HTMLElement): NodeSurface | undefined {
  const surface = host.querySelector<HTMLElement | SVGGeometryElement>(
    "[data-flow-node-surface]",
  );
  if (!surface) return;
  const hostBounds = host.getBoundingClientRect();
  const scale = hostBounds.width / host.offsetWidth;
  if (!Number.isFinite(scale) || scale <= 0) return;
  const bounds = surface.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const geometry = surface as SVGGeometryElement;
  const matrix =
    typeof geometry.getScreenCTM === "function"
      ? geometry.getScreenCTM()
      : null;
  const length =
    typeof geometry.getTotalLength === "function"
      ? geometry.getTotalLength()
      : 0;
  const vertices = (geometry as SVGPolygonElement).points;
  const count = vertices?.numberOfItems || 128;
  const outline =
    matrix && length > 0
      ? Array.from({ length: count }, (_, index) => {
          const point = vertices?.numberOfItems
            ? vertices.getItem(index)
            : geometry.getPointAtLength((length * index) / count);
          return {
            x: rounded(
              (matrix.a * point.x +
                matrix.c * point.y +
                matrix.e -
                hostBounds.left) /
                scale,
            ),
            y: rounded(
              (matrix.b * point.x +
                matrix.d * point.y +
                matrix.f -
                hostBounds.top) /
                scale,
            ),
          };
        })
      : undefined;
  return {
    left: rounded((bounds.left - hostBounds.left) / scale),
    top: rounded((bounds.top - hostBounds.top) / scale),
    width:
      surface instanceof HTMLElement
        ? surface.offsetWidth
        : rounded(bounds.width / scale),
    height:
      surface instanceof HTMLElement
        ? surface.offsetHeight
        : rounded(bounds.height / scale),
    radius: parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 0,
    ...(outline ? { outline } : {}),
  };
}

export function surfaceBox(host: Box, surface: NodeSurface): Box {
  const left = host.x - host.w / 2;
  const top = host.y - host.h / 2;
  return {
    x: left + surface.left + surface.width / 2,
    y: top + surface.top + surface.height / 2,
    w: surface.width,
    h: surface.height,
    ...(surface.outline
      ? {
          outline: surface.outline.map((point) => ({
            x: left + point.x,
            y: top + point.y,
          })),
        }
      : {}),
  };
}
