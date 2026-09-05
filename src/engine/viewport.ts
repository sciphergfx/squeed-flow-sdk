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
  private animationFrame?: number;
  private animationTimer?: ReturnType<typeof setTimeout>;

  cancelAnimation() {
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    clearTimeout(this.animationTimer);
    this.animationFrame = undefined;
    this.animationTimer = undefined;
  }

  transition(state: ViewportState, animate = false) {
    this.cancelAnimation();
    if (!animate || typeof requestAnimationFrame === "undefined" ||
      (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      this.set(state.pan, state.zoom);
      return;
    }
    const from = this.state;
    const target = { pan: { ...state.pan }, zoom: this.clamp(state.zoom) };
    const start = performance.now();
    const finish = () => { this.cancelAnimation(); this.set(target.pan, target.zoom); };
    const frame = (now: number) => {
      const progress = Math.min(1, (now - start) / 300);
      if (progress >= 1) { finish(); return; }
      const eased = progress * progress * (3 - 2 * progress);
      this.apply({ x: from.pan.x + (target.pan.x - from.pan.x) * eased, y: from.pan.y + (target.pan.y - from.pan.y) * eased }, from.zoom + (target.zoom - from.zoom) * eased);
      this.animationFrame = requestAnimationFrame(frame);
    };
    this.animationFrame = requestAnimationFrame(frame);
    this.animationTimer = setTimeout(finish, 400);
  }

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
    this.cancelAnimation();
    this.apply(pan, zoom);
  }

  private apply(pan?: Point, zoom?: number) {
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
  fit(bb: Rect, padding = 0, animate = false) {
    const w = bb.x2 - bb.x1;
    const h = bb.y2 - bb.y1;
    if (!(w > 0) || !(h > 0) || !this.size.w || !this.size.h) return;
    const zoom = this.clamp(
      Math.min(
        (this.size.w - 2 * padding) / w,
        (this.size.h - 2 * padding) / h,
      ),
    );
    this.transition({ pan: {
        x: (this.size.w - zoom * (bb.x1 + bb.x2)) / 2,
        y: (this.size.h - zoom * (bb.y1 + bb.y2)) / 2,
      },
      zoom }, animate);
  }

  /** cytoscape `cy.center(eles)` */
  center(bb: Rect, animate = false) {
    if (!this.size.w || !this.size.h) return;
    const z = this._zoom;
    this.transition({ pan: {
      x: (this.size.w - z * (bb.x1 + bb.x2)) / 2,
      y: (this.size.h - z * (bb.y1 + bb.y2)) / 2,
    }, zoom: z }, animate);
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
