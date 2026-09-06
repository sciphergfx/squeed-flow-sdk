import {
  boxToRect,
  type Box,
  type Point,
  type Rect,
  type PortAnchor,
  type PortSide,
} from "./types";

export type TaxiDir = "rightward" | "leftward" | "downward" | "upward";

export interface EdgeGeometry {
  /** SVG path of the line (endpoints already stand off the nodes and the arrowhead) */
  d: string;
  /** SVG path of the filled arrowhead, if any */
  arrow?: string;
  /** Label anchor (model units) and autorotate angle in degrees, range (-90, 90] */
  label: { x: number; y: number; angle: number };
}

export interface EdgeGeometryOptions {
  /** Gap between node border and line start/end (cytoscape `*-distance-from-node`) */
  srcDist: number;
  tgtDist: number;
  /** Extra line shortening under the arrowhead (cytoscape arrow `gap`) */
  arrowGap: number;
  /** cytoscape arrow "size" (`getArrowWidth`); triangle is 0.3×size long and wide */
  arrowSize: number;
  headShape?: "triangle" | "square";
  radius: number;
  arrowAt: "target" | "source" | "none";
  labelTargetLength?: number;
  labelFraction?: number;
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();
const pt = (p: Point) => `${f(p.x)} ${f(p.y)}`;
const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const subDWH = (dxy: number, dwh: number) =>
  dxy > 0 ? Math.max(dxy - dwh, 0) : Math.min(dxy + dwh, 0);

/** Port of cytoscape `findTaxiPoints` (taxi-turn as a fraction, explicit direction) */
export function taxiPoints(
  s: Box,
  t: Box,
  dir: TaxiDir,
  turn: number,
  minD = 10,
): Point[] {
  const pdx = t.x - s.x;
  const pdy = t.y - s.y;
  const dx = subDWH(pdx, (s.w + t.w) / 2);
  const dy = subDWH(pdy, (s.h + t.h) / 2);
  const isVert = dir === "downward" || dir === "upward";
  const l = isVert ? dy : dx;
  const pl = isVert ? pdy : pdx;
  const sgnL = sign(pl);
  const d = turn * l;
  const tooClose = (v: number) =>
    Math.abs(v) < minD || Math.abs(v) >= Math.abs(l);
  const isTooClose = tooClose(d) || tooClose(Math.abs(l) - Math.abs(d));

  let ctrl: number[];
  if (isTooClose) {
    if (isVert) {
      if (Math.abs(pl) <= s.h / 2) {
        const x = (s.x + t.x) / 2;
        ctrl = [x, s.y, x, t.y];
      } else if (Math.abs(pdx) <= t.w / 2) {
        const y = (s.y + t.y) / 2;
        ctrl = [s.x, y, t.x, y];
      } else ctrl = [s.x, t.y];
    } else if (Math.abs(pl) <= s.w / 2) {
      const y = (s.y + t.y) / 2;
      ctrl = [s.x, y, t.x, y];
    } else if (Math.abs(pdy) <= t.h / 2) {
      const x = (s.x + t.x) / 2;
      ctrl = [x, s.y, x, t.y];
    } else ctrl = [t.x, s.y];
  } else if (isVert) {
    const y = s.y + d + (s.h / 2) * sgnL;
    ctrl = [s.x, y, t.x, y];
  } else {
    const x = s.x + d + (s.w / 2) * sgnL;
    ctrl = [x, s.y, x, t.y];
  }

  const pts: Point[] = [{ x: s.x, y: s.y }];
  for (let i = 0; i < ctrl.length; i += 2)
    pts.push({ x: ctrl[i], y: ctrl[i + 1] });
  pts.push({ x: t.x, y: t.y });
  return pts;
}

/** Point where segment a→b (a inside `r`) crosses the rect boundary; null when b is inside too */
function exitRect(a: Point, b: Point, r: Rect): Point | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const tx = dx > 0 ? (r.x2 - a.x) / dx : dx < 0 ? (r.x1 - a.x) / dx : Infinity;
  const ty = dy > 0 ? (r.y2 - a.y) / dy : dy < 0 ? (r.y1 - a.y) / dy : Infinity;
  const t = Math.min(tx, ty);
  if (!Number.isFinite(t) || t >= 1 || t < 0) return null;
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function exitBox(start: Point, end: Point, box: Box): Point | null {
  if (!box.outline?.length) return exitRect(start, end, boxToRect(box));
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let nearest = Infinity;
  box.outline.forEach((vertex, index, vertices) => {
    const next = vertices[(index + 1) % vertices.length];
    const edgeX = next.x - vertex.x;
    const edgeY = next.y - vertex.y;
    const denominator = deltaX * edgeY - deltaY * edgeX;
    if (Math.abs(denominator) < 1e-9) return;
    const relativeX = vertex.x - start.x;
    const relativeY = vertex.y - start.y;
    const distance = (relativeX * edgeY - relativeY * edgeX) / denominator;
    const alongEdge = (relativeX * deltaY - relativeY * deltaX) / denominator;
    if (
      distance >= 0 &&
      distance < 1 &&
      alongEdge >= -1e-9 &&
      alongEdge <= 1 + 1e-9
    )
      nearest = Math.min(nearest, distance);
  });
  return Number.isFinite(nearest)
    ? { x: start.x + deltaX * nearest, y: start.y + deltaY * nearest }
    : null;
}

export function shapePort(
  box: Box,
  side: PortSide,
  position = 0.5,
): PortAnchor {
  const fraction = Number.isFinite(position)
    ? Math.max(0, Math.min(1, position))
    : 0.5;
  const vertical = side === "top" || side === "bottom";
  const direction = side === "top" || side === "left" ? -1 : 1;
  const start = {
    x: vertical ? box.x - box.w / 2 + box.w * fraction : box.x,
    y: vertical ? box.y : box.y - box.h / 2 + box.h * fraction,
  };
  const reach = Math.max(box.w, box.h) * 2 + 1;
  const point = exitBox(
    start,
    {
      x: start.x + (vertical ? 0 : direction * reach),
      y: start.y + (vertical ? direction * reach : 0),
    },
    box,
  ) ?? {
    x: vertical ? start.x : box.x + (direction * box.w) / 2,
    y: vertical ? box.y + (direction * box.h) / 2 : start.y,
  };
  return { ...point, side };
}

export function portOffset(anchor: PortAnchor, distance: number): Point {
  return {
    x:
      anchor.x +
      (anchor.side === "right"
        ? distance
        : anchor.side === "left"
          ? -distance
          : 0),
    y:
      anchor.y +
      (anchor.side === "bottom"
        ? distance
        : anchor.side === "top"
          ? -distance
          : 0),
  };
}

export function perimeterGeometry(
  source: PortAnchor,
  target: PortAnchor,
  options: EdgeGeometryOptions,
  type: string,
): EdgeGeometry {
  const start = portOffset(source, options.srcDist);
  const end = portOffset(target, options.tgtDist);
  if (type === "straight") return straightPortGeometry(start, end, options);
  const preferredReach = Math.max(
    80,
    Math.min(300, Math.hypot(end.x - start.x, end.y - start.y) / 3),
  );
  const facingGap =
    source.side === "bottom" && target.side === "top"
      ? end.y - start.y
      : source.side === "top" && target.side === "bottom"
        ? start.y - end.y
        : source.side === "right" && target.side === "left"
          ? end.x - start.x
          : source.side === "left" && target.side === "right"
            ? start.x - end.x
            : undefined;
  const reach =
    facingGap !== undefined && facingGap > 0
      ? Math.min(preferredReach, facingGap / 2)
      : preferredReach;
  const sourceLead = portOffset({ ...start, side: source.side }, reach);
  const targetLead = portOffset({ ...end, side: target.side }, reach);
  const lineStart =
    options.arrowAt === "source"
      ? shorten(start, sourceLead, options.arrowGap)
      : start;
  const lineEnd =
    options.arrowAt === "target"
      ? shorten(end, targetLead, options.arrowGap)
      : end;
  const arrow =
    options.arrowAt === "source"
      ? arrowPath(start, sourceLead, options.arrowSize, options.headShape)
      : options.arrowAt === "target"
        ? arrowPath(end, targetLead, options.arrowSize, options.headShape)
        : undefined;
  if (type === "bezier")
    return {
      d: `M${pt(lineStart)} C${pt(sourceLead)} ${pt(targetLead)} ${pt(lineEnd)}`,
      arrow,
      label: {
        x: (lineStart.x + 3 * sourceLead.x + 3 * targetLead.x + lineEnd.x) / 8,
        y: (lineStart.y + 3 * sourceLead.y + 3 * targetLead.y + lineEnd.y) / 8,
        angle: 0,
      },
    };
  const sourceHorizontal = source.side === "left" || source.side === "right";
  const targetHorizontal = target.side === "left" || target.side === "right";
  let bends: Point[];
  if (sourceHorizontal !== targetHorizontal) {
    const corner = sourceHorizontal
      ? { x: targetLead.x, y: sourceLead.y }
      : { x: sourceLead.x, y: targetLead.y };
    const sourceForward =
      (corner.x - sourceLead.x) * (sourceLead.x - start.x) +
        (corner.y - sourceLead.y) * (sourceLead.y - start.y) >=
      0;
    const targetForward =
      (corner.x - targetLead.x) * (targetLead.x - end.x) +
        (corner.y - targetLead.y) * (targetLead.y - end.y) >=
      0;
    bends = [
      sourceForward && targetForward
        ? corner
        : sourceHorizontal
          ? { x: sourceLead.x, y: targetLead.y }
          : { x: targetLead.x, y: sourceLead.y },
    ];
  } else if (facingGap !== undefined && facingGap <= 0) {
    if (sourceHorizontal) {
      const lane = (sourceLead.y + targetLead.y) / 2;
      bends = [
        { x: sourceLead.x, y: lane },
        { x: targetLead.x, y: lane },
      ];
    } else {
      const lane = (sourceLead.x + targetLead.x) / 2;
      bends = [
        { x: lane, y: sourceLead.y },
        { x: lane, y: targetLead.y },
      ];
    }
  } else if (sourceHorizontal) {
    const lane =
      source.side === target.side
        ? source.side === "right"
          ? Math.max(sourceLead.x, targetLead.x)
          : Math.min(sourceLead.x, targetLead.x)
        : (sourceLead.x + targetLead.x) / 2;
    bends = [
      { x: lane, y: sourceLead.y },
      { x: lane, y: targetLead.y },
    ];
  } else {
    const lane =
      source.side === target.side
        ? source.side === "bottom"
          ? Math.max(sourceLead.y, targetLead.y)
          : Math.min(sourceLead.y, targetLead.y)
        : (sourceLead.y + targetLead.y) / 2;
    bends = [
      { x: sourceLead.x, y: lane },
      { x: targetLead.x, y: lane },
    ];
  }
  const interior = [sourceLead, ...bends, targetLead].filter(
    (point, index, points) =>
      index === 0 ||
      point.x !== points[index - 1].x ||
      point.y !== points[index - 1].y,
  );
  return roundedGeometry(
    lineStart,
    interior,
    lineEnd,
    arrow,
    type === "orthogonal" ? 0 : options.radius,
  );
}

/** cytoscape `shortenIntersection`: move `p` toward `toward` by `amount` (clamped) */
function shorten(p: Point, toward: Point, amount: number): Point {
  const dx = p.x - toward.x;
  const dy = p.y - toward.y;
  const len = Math.hypot(dx, dy);
  if (!len) return p;
  let ratio = (len - amount) / len;
  if (ratio < 0) ratio = 0.00001;
  return { x: toward.x + ratio * dx, y: toward.y + ratio * dy };
}

function arrowPath(
  tip: Point,
  from: Point,
  size: number,
  shape: "triangle" | "square" = "triangle",
): string {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const L = (shape === "square" ? 0.15 : 0.3) * size;
  const W = 0.15 * size;
  const bx = tip.x - ux * L;
  const by = tip.y - uy * L;
  if (shape === "square") {
    return `M${pt(tip)} L${f(tip.x - uy * W)} ${f(tip.y + ux * W)} L${f(bx - uy * W)} ${f(by + ux * W)} L${f(bx + uy * W)} ${f(by - ux * W)} L${f(tip.x + uy * W)} ${f(tip.y - ux * W)} Z`;
  }
  return `M${pt(tip)} L${f(bx - uy * W)} ${f(by + ux * W)} L${f(bx + uy * W)} ${f(by - ux * W)} Z`;
}

/** cytoscape `lineAngleFromDelta` in degrees: never upside down */
function autoAngle(dx: number, dy: number): number {
  let a = Math.atan(dy / dx);
  if (dx === 0 && a < 0) a = -a;
  if (!Number.isFinite(a)) a = 0;
  return (a * 180) / Math.PI;
}

interface Corner {
  p1: Point;
  b: Point;
  p2: Point;
  r: number;
}

function cornerFor(a: Point, b: Point, c: Point, radius: number): Corner {
  const v1 = { x: b.x - a.x, y: b.y - a.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const l1 = Math.hypot(v1.x, v1.y);
  const l2 = Math.hypot(v2.x, v2.y);
  const cross = v1.x * v2.y - v1.y * v2.x;
  if (l1 < 1e-6 || l2 < 1e-6 || Math.abs(cross) < 1e-6)
    return { p1: b, b, p2: b, r: 0 };
  const r = Math.min(radius, l1 / 2, l2 / 2);
  return {
    p1: { x: b.x - (v1.x / l1) * r, y: b.y - (v1.y / l1) * r },
    b,
    p2: { x: b.x + (v2.x / l2) * r, y: b.y + (v2.y / l2) * r },
    r,
  };
}

/**
 * Clip a centre-to-centre polyline to the node borders, apply stand-offs and arrowhead,
 * and round the corners (cytoscape `round-taxi` semantics).
 */
export function polylineGeometry(
  pts: Point[],
  s: Box,
  t: Box,
  o: EdgeGeometryOptions,
): EdgeGeometry | null {
  let si = -1;
  let sExit: Point | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const e = exitBox(pts[i], pts[i + 1], s);
    if (e) {
      si = i;
      sExit = e;
      break;
    }
  }
  let ti = -1;
  let tExit: Point | null = null;
  for (let i = pts.length - 1; i > 0; i--) {
    const e = exitBox(pts[i], pts[i - 1], t);
    if (e) {
      ti = i;
      tExit = e;
      break;
    }
  }
  if (!sExit || !tExit || si >= ti) return null;

  const interior = pts.slice(si + 1, ti);
  const afterStart = interior[0] ?? tExit;
  const beforeEnd = interior[interior.length - 1] ?? sExit;

  let lineStart: Point;
  let lineEnd: Point;
  let arrow: string | undefined;
  if (o.arrowAt === "source") {
    const tip = shorten(sExit, afterStart, o.srcDist);
    lineStart = shorten(sExit, afterStart, o.srcDist + o.arrowGap);
    arrow = arrowPath(tip, afterStart, o.arrowSize, o.headShape);
  } else lineStart = shorten(sExit, afterStart, o.srcDist);
  if (o.arrowAt === "target") {
    const tip = shorten(tExit, beforeEnd, o.tgtDist);
    lineEnd = shorten(tExit, beforeEnd, o.tgtDist + o.arrowGap);
    arrow = arrowPath(tip, beforeEnd, o.arrowSize, o.headShape);
  } else lineEnd = shorten(tExit, beforeEnd, o.tgtDist);

  return roundedGeometry(
    lineStart,
    interior,
    lineEnd,
    arrow,
    o.radius,
    o.labelTargetLength,
    o.labelFraction,
  );
}

function roundedGeometry(
  lineStart: Point,
  interior: Point[],
  lineEnd: Point,
  arrow: string | undefined,
  radius: number,
  labelTargetLength?: number,
  labelFraction?: number,
): EdgeGeometry {
  const all = [lineStart, ...interior, lineEnd];
  const corners: Corner[] = [];
  let d = `M${pt(lineStart)}`;
  for (let i = 1; i < all.length - 1; i++) {
    const c = cornerFor(all[i - 1], all[i], all[i + 1], radius);
    corners.push(c);
    if (c.r === 0) d += ` L${pt(c.b)}`;
    else d += ` L${pt(c.p1)} Q${pt(c.b)} ${pt(c.p2)}`;
  }
  d += ` L${pt(lineEnd)}`;

  // Label: cytoscape `storeAllpts` / `calculateArrowAngles` for segments
  let label: EdgeGeometry["label"];
  const n = interior.length;
  if (n === 0) {
    label = {
      x: (lineStart.x + lineEnd.x) / 2,
      y: (lineStart.y + lineEnd.y) / 2,
      angle: autoAngle(lineEnd.x - lineStart.x, lineEnd.y - lineStart.y),
    };
  } else if (n % 2 === 0) {
    const a = interior[n / 2 - 1];
    const b = interior[n / 2];
    label = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      angle: autoAngle(b.x - a.x, b.y - a.y),
    };
  } else {
    const c = corners[(n - 1) / 2];
    if (c.r === 0) {
      const next = all[(n - 1) / 2 + 2];
      label = {
        x: c.b.x,
        y: c.b.y,
        angle: autoAngle(next.x - c.b.x, next.y - c.b.y),
      };
    } else {
      label = {
        x: 0.25 * c.p1.x + 0.5 * c.b.x + 0.25 * c.p2.x,
        y: 0.25 * c.p1.y + 0.5 * c.b.y + 0.25 * c.p2.y,
        angle: autoAngle(c.p2.x - c.p1.x, c.p2.y - c.p1.y),
      };
    }
  }
  if (labelTargetLength !== undefined) {
    if (labelFraction !== undefined && corners.length === 2) {
      const start = corners[0].p2;
      const end = corners[1].p1;
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const margin = Math.min(0.5, labelTargetLength / (2 * length));
      const fraction = Math.max(margin, Math.min(1 - margin, labelFraction));
      label = {
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
        angle: autoAngle(end.x - start.x, end.y - start.y),
      };
    }
    const branchStart = corners[corners.length - 1]?.p2 ?? lineStart;
    const deltaX = lineEnd.x - branchStart.x;
    const deltaY = lineEnd.y - branchStart.y;
    if (Math.hypot(deltaX, deltaY) >= labelTargetLength) {
      label = {
        x: (branchStart.x + lineEnd.x) / 2,
        y: (branchStart.y + lineEnd.y) / 2,
        angle: autoAngle(deltaX, deltaY),
      };
    }
  }
  return { d, arrow, label };
}

export function propertyGeometry(
  source: Box,
  target: Box,
  dir: TaxiDir,
  sourceY: number | undefined,
  targetY: number | undefined,
  turn: number,
  options: EdgeGeometryOptions,
): EdgeGeometry {
  const direction = dir === "leftward" ? -1 : 1;
  const start = {
    x: source.x + direction * (source.w / 2 + options.srcDist),
    y: sourceY ?? source.y,
  };
  const end = {
    x: target.x - direction * (target.w / 2 + options.tgtDist),
    y: targetY ?? target.y,
  };
  const clearance = Math.max(80, options.arrowGap + options.arrowSize * 0.3);
  const sourceStub = start.x + direction * clearance;
  const targetStub = end.x - direction * clearance;
  let interior: Point[];
  if (direction * (targetStub - sourceStub) >= 0) {
    const desired = start.x + (end.x - start.x) * turn;
    const column = Math.max(
      Math.min(sourceStub, targetStub),
      Math.min(Math.max(sourceStub, targetStub), desired),
    );
    interior = [
      { x: column, y: start.y },
      { x: column, y: end.y },
    ];
  } else {
    const row =
      Math.min(source.y - source.h / 2, target.y - target.h / 2) -
      clearance * (1 + turn);
    interior = [
      { x: sourceStub, y: start.y },
      { x: sourceStub, y: row },
      { x: targetStub, y: row },
      { x: targetStub, y: end.y },
    ];
  }
  const lineStart =
    options.arrowAt === "source"
      ? shorten(start, interior[0], options.arrowGap)
      : start;
  const lineEnd =
    options.arrowAt === "target"
      ? shorten(end, interior[interior.length - 1], options.arrowGap)
      : end;
  const arrow =
    options.arrowAt === "source"
      ? arrowPath(start, interior[0], options.arrowSize, options.headShape)
      : options.arrowAt === "target"
        ? arrowPath(
            end,
            interior[interior.length - 1],
            options.arrowSize,
            options.headShape,
          )
        : undefined;
  return roundedGeometry(lineStart, interior, lineEnd, arrow, options.radius);
}

export function taxiGeometry(
  s: Box,
  t: Box,
  dir: TaxiDir,
  turn: number,
  o: EdgeGeometryOptions,
): EdgeGeometry | null {
  return polylineGeometry(taxiPoints(s, t, dir, turn), s, t, o);
}

export function connectorEndpoints(
  source: Box,
  target: Box,
  dir: TaxiDir,
  sourceY: number | undefined,
  targetY: number | undefined,
  distance: number,
): { sourcePoint: Point; targetPoint: Point } {
  const vertical =
    sourceY === undefined &&
    targetY === undefined &&
    (dir === "downward" || dir === "upward");
  const forward = dir === "leftward" || (vertical && dir === "upward") ? -1 : 1;
  const endpoint = (box: Box, row: number | undefined, sign: number): Point => {
    const start = { x: box.x, y: row ?? box.y };
    const reach = Math.max(box.w, box.h) * 2 + 1;
    const boundary = exitBox(
      start,
      {
        x: start.x + (vertical ? 0 : sign * reach),
        y: start.y + (vertical ? sign * reach : 0),
      },
      box,
    );
    if (boundary)
      return {
        x: boundary.x + (vertical ? 0 : sign * distance),
        y: boundary.y + (vertical ? sign * distance : 0),
      };
    return vertical
      ? { x: box.x, y: box.y + sign * (box.h / 2 + distance) }
      : { x: box.x + sign * (box.w / 2 + distance), y: row ?? box.y };
  };
  return {
    sourcePoint: endpoint(source, sourceY, forward),
    targetPoint: endpoint(target, targetY, -forward),
  };
}

export function bezierGeometry(
  source: Point,
  target: Point,
  dir: TaxiDir,
  options: EdgeGeometryOptions,
): EdgeGeometry {
  const vertical = dir === "downward" || dir === "upward";
  const forward = dir === "leftward" || dir === "upward" ? -1 : 1;
  const reach = Math.max(
    100,
    Math.abs(vertical ? target.y - source.y : target.x - source.x) / 2,
  );
  const controlSource = {
    x: source.x + (vertical ? 0 : forward * reach),
    y: source.y + (vertical ? forward * reach : 0),
  };
  const controlTarget = {
    x: target.x - (vertical ? 0 : forward * reach),
    y: target.y - (vertical ? forward * reach : 0),
  };
  const start =
    options.arrowAt === "source"
      ? shorten(source, controlSource, options.arrowGap)
      : source;
  const end =
    options.arrowAt === "target"
      ? shorten(target, controlTarget, options.arrowGap)
      : target;
  return {
    d: `M${pt(start)} C${pt(controlSource)} ${pt(controlTarget)} ${pt(end)}`,
    arrow:
      options.arrowAt === "source"
        ? arrowPath(source, controlSource, options.arrowSize, options.headShape)
        : options.arrowAt === "target"
          ? arrowPath(
              target,
              controlTarget,
              options.arrowSize,
              options.headShape,
            )
          : undefined,
    label: {
      x: (start.x + 3 * controlSource.x + 3 * controlTarget.x + end.x) / 8,
      y: (start.y + 3 * controlSource.y + 3 * controlTarget.y + end.y) / 8,
      angle: autoAngle(
        end.x + controlTarget.x - controlSource.x - start.x,
        end.y + controlTarget.y - controlSource.y - start.y,
      ),
    },
  };
}

export function straightPortGeometry(
  source: Point,
  target: Point,
  options: EdgeGeometryOptions,
): EdgeGeometry {
  const start =
    options.arrowAt === "source"
      ? shorten(source, target, options.arrowGap)
      : source;
  const end =
    options.arrowAt === "target"
      ? shorten(target, source, options.arrowGap)
      : target;
  const arrow =
    options.arrowAt === "source"
      ? arrowPath(source, target, options.arrowSize, options.headShape)
      : options.arrowAt === "target"
        ? arrowPath(target, source, options.arrowSize, options.headShape)
        : undefined;
  return roundedGeometry(start, [], end, arrow, 0);
}

/** Port of cytoscape `findLoopPoints` + the two-quadratic self-edge drawing */
export function loopGeometry(
  b: Box,
  loopIndex: number,
  o: EdgeGeometryOptions,
  loopDirDeg = -90,
  loopSweepDeg = -60,
  stepSize = 350,
): EdgeGeometry | null {
  const loopDir = (loopDirDeg * Math.PI) / 180;
  const loopSwp = (loopSweepDeg * Math.PI) / 180;
  const loopAngle = loopDir - Math.PI / 2;
  const outAngle = loopAngle - loopSwp / 2;
  const inAngle = loopAngle + loopSwp / 2;
  const k = 1.4 * stepSize * (loopIndex / 3 + 1);
  const c1 = {
    x: b.x + Math.cos(outAngle) * k,
    y: b.y + Math.sin(outAngle) * k,
  };
  const c2 = { x: b.x + Math.cos(inAngle) * k, y: b.y + Math.sin(inAngle) * k };
  const center = { x: b.x, y: b.y };
  const sExit = exitBox(center, c1, b);
  const tExit = exitBox(center, c2, b);
  if (!sExit || !tExit) return null;
  const mid = { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };

  let lineStart = shorten(sExit, c1, o.srcDist);
  let lineEnd = shorten(tExit, c2, o.tgtDist);
  let arrow: string | undefined;
  if (o.arrowAt === "target") {
    const tip = lineEnd;
    lineEnd = shorten(tExit, c2, o.tgtDist + o.arrowGap);
    arrow = arrowPath(tip, c2, o.arrowSize, o.headShape);
  } else if (o.arrowAt === "source") {
    const tip = lineStart;
    lineStart = shorten(sExit, c1, o.srcDist + o.arrowGap);
    arrow = arrowPath(tip, c1, o.arrowSize, o.headShape);
  }
  const d = `M${pt(lineStart)} Q${pt(c1)} ${pt(mid)} Q${pt(c2)} ${pt(lineEnd)}`;
  return {
    d,
    arrow,
    label: { x: mid.x, y: mid.y, angle: autoAngle(c2.x - c1.x, c2.y - c1.y) },
  };
}
