import type { Point, Rect, ViewportState } from "./types";

type Listener = (vp: ViewportState) => void;

/** Pan/zoom state in cytoscape's convention: rendered = model * zoom + pan */
export class Viewport {
  private _pan: Point;
  private _zoom: number;
  minZoom: number;
  maxZoom: number;
  /** Container size in rendered px; kept current by the canvas ResizeObserver */
  size = { w: 0, h: 0 };
  private listeners = new Set<Listener>();

  constructor(init: ViewportState, minZoom: number, maxZoom: number) {
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this._pan = { ...init.pan };
    this._zoom = this.clamp(init.zoom);
  }

  get pan(): Point {
    return { ...this._pan };
  }
  get zoom() {
    return this._zoom;
  }
  get state(): ViewportState {
    return { pan: this.pan, zoom: this._zoom };
  }

  private clamp(z: number) {
    if (!Number.isFinite(z)) return this.minZoom;
    return Math.max(this.minZoom, Math.min(this.maxZoom, z));
  }

  set(pan?: Point, zoom?: number) {
    let changed = false;
    if (pan && (pan.x !== this._pan.x || pan.y !== this._pan.y)) {
      this._pan = { x: pan.x, y: pan.y };
      changed = true;
    }
    if (zoom !== undefined) {
      const z = this.clamp(zoom);
      if (z !== this._zoom) {
        this._zoom = z;
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  zoomAt(level: number, rendered: Point) {
    const z1 = this.clamp(level);
    const z0 = this._zoom;
    if (z1 === z0) return;
    const k = z1 / z0;
    this.set(
      {
        x: rendered.x - (rendered.x - this._pan.x) * k,
        y: rendered.y - (rendered.y - this._pan.y) * k,
      },
      z1,
    );
  }

  /** cytoscape `cy.fit(eles, padding)` */
  fit(bb: Rect, padding = 0) {
    const w = bb.x2 - bb.x1;
    const h = bb.y2 - bb.y1;
    if (!(w > 0) || !(h > 0) || !this.size.w || !this.size.h) return;
    const zoom = this.clamp(
      Math.min(
        (this.size.w - 2 * padding) / w,
        (this.size.h - 2 * padding) / h,
      ),
    );
    this.set(
      {
        x: (this.size.w - zoom * (bb.x1 + bb.x2)) / 2,
        y: (this.size.h - zoom * (bb.y1 + bb.y2)) / 2,
      },
      zoom,
    );
  }

  /** cytoscape `cy.center(eles)` */
  center(bb: Rect) {
    if (!this.size.w || !this.size.h) return;
    const z = this._zoom;
    this.set({
      x: (this.size.w - z * (bb.x1 + bb.x2)) / 2,
      y: (this.size.h - z * (bb.y1 + bb.y2)) / 2,
    });
  }

  renderedToModel(p: Point): Point {
    return {
      x: (p.x - this._pan.x) / this._zoom,
      y: (p.y - this._pan.y) / this._zoom,
    };
  }

  modelToRendered(p: Point): Point {
    return {
      x: p.x * this._zoom + this._pan.x,
      y: p.y * this._zoom + this._pan.y,
    };
  }

  onChange(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const s = this.state;
    this.listeners.forEach((fn) => fn(s));
  }
}
