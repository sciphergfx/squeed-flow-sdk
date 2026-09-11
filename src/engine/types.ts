import type {
  NodeCollision,
  NodeCollisionOptions,
  NodeCollisionResolution,
  NodeGridArrangement,
  NodeGridOptions,
  ResolveNodeCollisionsOptions,
} from "./nodeCollisions";

export interface Point {
  x: number;
  y: number;
}

export type PortSide = "top" | "right" | "bottom" | "left";
export interface PortAnchor extends Point {
  side: PortSide;
}

/** Centre + size, model units (matches cytoscape's node position/width/height) */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  outline?: Point[];
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ViewportState {
  pan: Point;
  zoom: number;
}

/** Handle passed to `callbacks.onInit`. */
export interface FlowEngine {
  zoom(): number;
  /** Set zoom keeping the current pan (like cytoscape `cy.zoom(level)`) */
  zoom(level: number): void;
  pan(): Point;
  pan(p: Point): void;
  /** Zoom keeping the model point under `renderedPoint` (container px) fixed */
  zoomAt(level: number, renderedPoint: Point): void;
  /** Fit all elements into the container with `padding` rendered px */
  fit(padding?: number, animate?: boolean, afterViewChange?: boolean): void;
  /** Explicit alias for fit: fit and centre all elements with screen-pixel padding. */
  centerAndFit(
    padding?: number,
    animate?: boolean,
    afterViewChange?: boolean,
  ): void;
  /** Centre all elements at the current zoom */
  center(animate?: boolean): void;
  /** Fit one node; afterViewChange waits for opening geometry. Padding is in screen pixels (default 50). */
  focusNode(
    id: string,
    padding?: number,
    animate?: boolean,
    afterViewChange?: boolean,
  ): void;
  /** Fit laid-out hierarchy descendants and outgoing reachable nodes. Does not expand collapsed nodes. Animate overrides config.animateViewport. */
  focusBranch(id: string, padding?: number, animate?: boolean, afterViewChange?: boolean): void;
  focusConnections(
    id: string,
    padding?: number,
    animate?: boolean,
    afterViewChange?: boolean,
  ): void;
  isolateConnections(id: string, padding?: number, animate?: boolean): void;
  /** Temporarily show only this branch and fit it, preserving graph data. */
  isolateBranch(id: string, padding?: number, animate?: boolean): void;
  /** End isolation and restore the viewport saved when isolation began. */
  restoreView(animate?: boolean, state?: ViewportState): void;
  /** Hide/show edge paths, labels and hit targets without changing graph data. */
  setEdgesVisible(visible: boolean): void;
  clientToModel(clientX: number, clientY: number): Point;
  modelToClient(p: Point): Point;
  getNodeBox(id: string): Box | undefined;
  detectNodeCollisions(options?: NodeCollisionOptions): NodeCollision[];
  resolveNodeCollisions(
    options?: ResolveNodeCollisionsOptions,
  ): NodeCollisionResolution;
  arrangeNodesInGrid(options?: NodeGridOptions): NodeGridArrangement;
  setNodeGridMode(enabled: boolean, options?: NodeGridOptions): void;
  swapGridNodes(source: string, target: string, animate?: boolean): boolean;
  setNodePosition(
    id: string,
    position: Point | undefined,
    options?: { persist?: boolean },
  ): boolean;
  onViewportChange(fn: (vp: ViewportState) => void): () => void;
}

export const boxToRect = (b: Box): Rect => ({
  x1: b.x - b.w / 2,
  y1: b.y - b.h / 2,
  x2: b.x + b.w / 2,
  y2: b.y + b.h / 2,
});

export const rectToBox = (r: Rect): Box => ({
  x: (r.x1 + r.x2) / 2,
  y: (r.y1 + r.y2) / 2,
  w: r.x2 - r.x1,
  h: r.y2 - r.y1,
});

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const r = { ...rects[0] };
  for (let i = 1; i < rects.length; i++) {
    r.x1 = Math.min(r.x1, rects[i].x1);
    r.y1 = Math.min(r.y1, rects[i].y1);
    r.x2 = Math.max(r.x2, rects[i].x2);
    r.y2 = Math.max(r.y2, rects[i].y2);
  }
  return r;
}

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;

export const pointInRect = (p: Point, r: Rect) =>
  p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
