import { computeContainers } from "./layout";
import { boxToRect, type Point, type Rect } from "./types";

export interface NodeCollisionOptions {
  margin?: number;
}

export interface ResolveNodeCollisionsOptions extends NodeCollisionOptions {
  animate?: boolean;
  maxIterations?: number;
}

export interface NodeGridOptions extends NodeCollisionOptions {
  adjustment?: {
    enabled?: boolean;
    sections?: Record<string, { rows?: number[]; columns?: number[][] }>;
  };
  order?: string[];
  columns?: number;
  animate?: boolean;
  gaps?: number | { x: number; y: number };
  fill?: boolean;
  padding?: number;
}

export interface NodeGridArrangement {
  dividers?: GridDivider[];
  positions: Map<string, Point>;
  movedNodeIds: string[];
  skippedNodeIds: string[];
  collisions: NodeCollision[];
  bounds?: Rect;
  sizes?: Map<string, { w: number; h: number }>;
}

export interface GridDivider {
  section: string;
  axis: "x" | "y";
  row: number;
  index: number;
  weights: number[];
  length: number;
  position: Point;
}

export function adjustGridDivider(
  options: NodeGridOptions,
  divider: GridDivider,
  delta: number,
): NodeGridOptions {
  const weights = [...divider.weights];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const pair = weights[divider.index] + weights[divider.index + 1];
  const first = Math.min(
    pair * 0.95,
    Math.max(
      pair * 0.05,
      weights[divider.index] + (delta / divider.length) * total,
    ),
  );
  weights[divider.index] = first;
  weights[divider.index + 1] = pair - first;
  const section = { ...options.adjustment?.sections?.[divider.section] };
  if (divider.axis === "y") section.rows = weights;
  else {
    section.columns = [...(section.columns ?? [])];
    while (section.columns.length <= divider.row) section.columns.push([]);
    section.columns[divider.row] = weights;
  }
  return {
    ...options,
    adjustment: {
      ...options.adjustment,
      sections: { ...options.adjustment?.sections, [divider.section]: section },
    },
  };
}

export function validateGridAdjustment(
  adjustment: NodeGridOptions["adjustment"],
) {
  if (adjustment === undefined) return;
  if (
    !adjustment ||
    typeof adjustment !== "object" ||
    Array.isArray(adjustment) ||
    (adjustment.enabled !== undefined &&
      typeof adjustment.enabled !== "boolean")
  )
    throw new RangeError("Invalid grid adjustment.");
  const validWeights = (weights: unknown): weights is number[] =>
    Array.isArray(weights) &&
    weights.length <= 10000 &&
    weights.every(
      (weight) =>
        typeof weight === "number" &&
        Number.isFinite(weight) &&
        weight > 0 &&
        weight <= 1000000,
    );
  if (
    adjustment.sections !== undefined &&
    (!adjustment.sections ||
      typeof adjustment.sections !== "object" ||
      Array.isArray(adjustment.sections))
  )
    throw new RangeError("Invalid grid sections.");
  for (const [id, section] of Object.entries(adjustment.sections ?? {})) {
    if (
      ["__proto__", "constructor", "prototype"].includes(id) ||
      !section ||
      typeof section !== "object" ||
      Array.isArray(section) ||
      (section.rows !== undefined && !validWeights(section.rows)) ||
      (section.columns !== undefined &&
        (!Array.isArray(section.columns) ||
          section.columns.length > 10000 ||
          !section.columns.every(validWeights)))
    )
      throw new RangeError("Invalid grid section proportions.");
  }
}

export interface NodeCollision {
  source: string;
  target: string;
  overlap: Point;
}

export interface NodeCollisionResolution {
  positions: Map<string, Point>;
  movedNodeIds: string[];
  collisions: NodeCollision[];
  iterations: number;
  resolved: boolean;
}

export interface CollisionGeometry {
  nodes: { id: string; parent?: string }[];
  positions: Map<string, Point>;
  sizes: Map<string, { w: number; h: number }>;
  padding: (id: string) => number;
  minSize: (id: string) => { w: number; h: number } | undefined;
  fixedIds: ReadonlySet<string>;
  viewportSize?: { w: number; h: number };
}

function collisionMargin(options: NodeCollisionOptions) {
  const margin = options.margin ?? 15;
  if (!Number.isFinite(margin) || margin < 0)
    throw new RangeError("Collision margin must be finite and non-negative.");
  return margin;
}

function collisionTree(geometry: CollisionGeometry) {
  const byId = new Map(geometry.nodes.map((node) => [node.id, node]));
  const children = new Map<string | undefined, string[]>();
  for (const node of geometry.nodes) {
    const parent =
      node.parent && byId.has(node.parent) ? node.parent : undefined;
    const siblings = children.get(parent) ?? [];
    siblings.push(node.id);
    children.set(parent, siblings);
  }
  const groups: string[][] = [];
  const leaves = new Map<string, string[]>();
  const visit = (id: string): string[] => {
    const descendants = children.get(id);
    const movable = descendants
      ? descendants.flatMap(visit)
      : geometry.positions.has(id)
        ? [id]
        : [];
    leaves.set(id, movable);
    if (descendants) groups.push(descendants);
    return movable;
  };
  const roots = children.get(undefined) ?? [];
  roots.forEach(visit);
  groups.push(roots);
  return { groups, leaves, children, roots };
}

function collisionBoxes(
  geometry: CollisionGeometry,
  positions: Map<string, Point>,
) {
  const boxes = computeContainers(
    geometry.nodes,
    positions,
    geometry.sizes,
    geometry.padding,
    geometry.minSize,
  );
  for (const node of geometry.nodes) {
    if (boxes.has(node.id)) continue;
    const position = positions.get(node.id);
    const size = geometry.sizes.get(node.id);
    if (position && size)
      boxes.set(node.id, boxToRect({ ...position, ...size }));
  }
  return boxes;
}

function overlapBetween(
  source: string,
  target: string,
  boxes: Map<string, Rect>,
  margin: number,
): NodeCollision | undefined {
  const first = boxes.get(source);
  const second = boxes.get(target);
  if (!first || !second) return;
  const overlap = {
    x: Math.min(first.x2 - second.x1, second.x2 - first.x1) + margin,
    y: Math.min(first.y2 - second.y1, second.y2 - first.y1) + margin,
  };
  if (overlap.x > 0.001 && overlap.y > 0.001)
    return { source, target, overlap };
}

function collisionsIn(
  groups: string[][],
  boxes: Map<string, Rect>,
  margin: number,
) {
  const collisions: NodeCollision[] = [];
  for (const siblings of groups)
    for (let first = 0; first < siblings.length; first++)
      for (let second = first + 1; second < siblings.length; second++) {
        const collision = overlapBetween(
          siblings[first],
          siblings[second],
          boxes,
          margin,
        );
        if (collision) collisions.push(collision);
      }
  return collisions;
}

export function detectNodeCollisions(
  geometry: CollisionGeometry,
  options: NodeCollisionOptions = {},
): NodeCollision[] {
  const margin = collisionMargin(options);
  const { groups } = collisionTree(geometry);
  return collisionsIn(
    groups,
    collisionBoxes(geometry, geometry.positions),
    margin,
  );
}

export function arrangeNodesInGrid(
  geometry: CollisionGeometry,
  options: NodeGridOptions = {},
): NodeGridArrangement {
  validateGridAdjustment(options.adjustment);
  const margin = collisionMargin(options);
  const gaps =
    typeof options.gaps === "object"
      ? options.gaps
      : { x: options.gaps ?? margin, y: options.gaps ?? margin };
  if (!gaps || [gaps.x, gaps.y].some((gap) => !Number.isFinite(gap) || gap < 0))
    throw new RangeError("Grid gaps must be finite and non-negative.");
  const padding = options.padding ?? 0;
  if (!Number.isFinite(padding) || padding < 0)
    throw new RangeError("Grid padding must be finite and non-negative.");
  if (
    options.columns !== undefined &&
    (!Number.isSafeInteger(options.columns) || options.columns < 1)
  )
    throw new RangeError("Grid columns must be a positive safe integer.");
  if (options.fill && geometry.viewportSize)
    return fillNodeGrid(geometry, options, gaps, padding);
  const { groups, leaves } = collisionTree(geometry);
  const positions = new Map(
    [...geometry.positions].map(([id, position]) => [id, { ...position }]),
  );
  const skipped = new Set<string>();
  for (const siblings of groups) {
    const boxes = collisionBoxes(geometry, positions);
    const items = siblings.filter((id) => boxes.has(id));
    if (items.length < 2) continue;
    const pinned = items.some(
      (id) =>
        geometry.fixedIds.has(id) ||
        (leaves.get(id) ?? []).some((leaf) => geometry.fixedIds.has(leaf)),
    );
    if (pinned) {
      items.forEach((id) => skipped.add(id));
      continue;
    }
    const bounds = items.map((id) => boxes.get(id)!);
    const cellWidth = Math.max(...bounds.map((box) => box.x2 - box.x1));
    const cellHeight = Math.max(...bounds.map((box) => box.y2 - box.y1));
    const columns = Math.min(
      items.length,
      options.columns ?? Math.ceil(Math.sqrt(items.length)),
    );
    const rows = Math.ceil(items.length / columns);
    const stepX = cellWidth + gaps.x;
    const stepY = cellHeight + gaps.y;
    const centers = bounds.map((box) => ({
      x: (box.x1 + box.x2) / 2,
      y: (box.y1 + box.y2) / 2,
    }));
    const centerX =
      (Math.min(...centers.map((point) => point.x)) +
        Math.max(...centers.map((point) => point.x))) /
      2;
    const centerY =
      (Math.min(...centers.map((point) => point.y)) +
        Math.max(...centers.map((point) => point.y))) /
      2;
    items.forEach((id, index) => {
      const box = boxes.get(id)!;
      const offset = {
        x:
          centerX +
          ((index % columns) - (columns - 1) / 2) * stepX -
          (box.x1 + box.x2) / 2,
        y:
          centerY +
          (Math.floor(index / columns) - (rows - 1) / 2) * stepY -
          (box.y1 + box.y2) / 2,
      };
      for (const leaf of leaves.get(id) ?? []) {
        const position = positions.get(leaf)!;
        positions.set(leaf, {
          x: position.x + offset.x,
          y: position.y + offset.y,
        });
      }
    });
  }
  const movedNodeIds = [...positions]
    .filter(([id, position]) => {
      const previous = geometry.positions.get(id)!;
      return position.x !== previous.x || position.y !== previous.y;
    })
    .map(([id]) => id);
  return {
    positions,
    movedNodeIds,
    skippedNodeIds: [...skipped],
    collisions: collisionsIn(
      groups,
      collisionBoxes(geometry, positions),
      Math.min(gaps.x, gaps.y),
    ),
  };
}

function fillNodeGrid(
  geometry: CollisionGeometry,
  options: NodeGridOptions,
  gaps: Point,
  padding: number,
): NodeGridArrangement {
  const { groups, children, roots } = collisionTree(geometry);
  const positions = new Map(
    [...geometry.positions].map(([id, position]) => [id, { ...position }]),
  );
  if (geometry.nodes.some((node) => geometry.fixedIds.has(node.id)))
    return {
      positions,
      movedNodeIds: [],
      skippedNodeIds: geometry.nodes.map((node) => node.id),
      collisions: detectNodeCollisions(geometry, {
        margin: Math.min(gaps.x, gaps.y),
      }),
    };
  const viewport = geometry.viewportSize!;
  const insetX = Math.min(padding, Math.max(0, (viewport.w - 1) / 2));
  const insetY = Math.min(padding, Math.max(0, (viewport.h - 1) / 2));
  const bounds = {
    x1: insetX,
    y1: insetY,
    x2: Math.max(insetX + 1, viewport.w - insetX),
    y2: Math.max(insetY + 1, viewport.h - insetY),
  };
  const sizes = new Map<string, { w: number; h: number }>();
  const dividers: GridDivider[] = [];
  const place = (ids: string[], area: Rect, sectionId = "canvas") => {
    if (!ids.length) return;
    const width = area.x2 - area.x1;
    const height = area.y2 - area.y1;
    const columns = Math.min(
      ids.length,
      options.columns ??
        Math.max(1, Math.round(Math.sqrt((ids.length * width) / height))),
    );
    const rows = Math.ceil(ids.length / columns);
    const gapY = Math.min(gaps.y, height / (2 * rows));
    const section = options.adjustment?.sections?.[sectionId];
    const rowWeights = Array.from(
      { length: rows },
      (_, index) => section?.rows?.[index] ?? 1,
    );
    const rowTotal = rowWeights.reduce((sum, weight) => sum + weight, 0);
    const rowSpace = height - (rows - 1) * gapY;
    let top = area.y1;
    for (let row = 0; row < rows; row++) {
      const cellHeight = (rowSpace * rowWeights[row]) / rowTotal;
      const rowCount = Math.min(columns, ids.length - row * columns);
      const gapX = Math.min(gaps.x, width / (2 * rowCount));
      const columnWeights = Array.from(
        { length: rowCount },
        (_, index) => section?.columns?.[row]?.[index] ?? 1,
      );
      const columnTotal = columnWeights.reduce(
        (sum, weight) => sum + weight,
        0,
      );
      const columnSpace = width - (rowCount - 1) * gapX;
      let left = area.x1;
      for (let column = 0; column < rowCount; column++) {
        const id = ids[row * columns + column];
        const cellWidth = (columnSpace * columnWeights[column]) / columnTotal;
        const descendants = children.get(id);
        if (descendants) {
          const pad = Math.min(
            geometry.padding(id),
            Math.max(0, (Math.min(cellWidth, cellHeight) - 1) / 2),
          );
          place(
            descendants,
            {
              x1: left + pad,
              y1: top + pad,
              x2: left + cellWidth - pad,
              y2: top + cellHeight - pad,
            },
            id,
          );
        } else if (positions.has(id)) {
          positions.set(id, {
            x: left + cellWidth / 2,
            y: top + cellHeight / 2,
          });
          sizes.set(id, { w: cellWidth, h: cellHeight });
        }
        if (column < rowCount - 1)
          dividers.push({
            section: sectionId,
            axis: "x",
            row,
            index: column,
            weights: columnWeights,
            length: columnSpace,
            position: {
              x: left + cellWidth + gapX / 2,
              y: top + cellHeight / 2,
            },
          });
        left += cellWidth + gapX;
      }
      if (row < rows - 1)
        dividers.push({
          section: sectionId,
          axis: "y",
          row,
          index: row,
          weights: rowWeights,
          length: rowSpace,
          position: { x: area.x1 + width / 2, y: top + cellHeight + gapY / 2 },
        });
      top += cellHeight + gapY;
    }
  };
  place(roots, bounds);
  const movedNodeIds = [...positions]
    .filter(([id, position]) => {
      const before = geometry.positions.get(id)!;
      return position.x !== before.x || position.y !== before.y;
    })
    .map(([id]) => id);
  return {
    positions,
    movedNodeIds,
    skippedNodeIds: [],
    bounds,
    sizes,
    dividers,
    collisions: collisionsIn(
      groups,
      collisionBoxes({ ...geometry, sizes }, positions),
      0,
    ),
  };
}

export function resolveNodeCollisions(
  geometry: CollisionGeometry,
  options: ResolveNodeCollisionsOptions = {},
): NodeCollisionResolution {
  const margin = collisionMargin(options);
  const maxIterations = options.maxIterations ?? 50;
  if (
    !Number.isInteger(maxIterations) ||
    maxIterations < 0 ||
    maxIterations > 1000
  )
    throw new RangeError(
      "Collision maxIterations must be an integer between 0 and 1000.",
    );
  const { groups, leaves } = collisionTree(geometry);
  const positions = new Map(
    [...geometry.positions].map(([id, position]) => [id, { ...position }]),
  );
  const fixed = (id: string) =>
    geometry.fixedIds.has(id) ||
    (leaves.get(id) ?? []).some((leaf) => geometry.fixedIds.has(leaf));
  let collisions = collisionsIn(
    groups,
    collisionBoxes(geometry, positions),
    margin,
  );
  let iterations = 0;
  while (collisions.length && iterations < maxIterations) {
    let changed = false;
    for (const siblings of groups) {
      if (siblings.length < 2) continue;
      const boxes = collisionBoxes(geometry, positions);
      const move = (id: string, axis: "x" | "y", distance: number) => {
        for (const leaf of leaves.get(id) ?? [])
          positions.get(leaf)![axis] += distance;
        const box = boxes.get(id)!;
        if (axis === "x") {
          box.x1 += distance;
          box.x2 += distance;
        } else {
          box.y1 += distance;
          box.y2 += distance;
        }
      };
      for (let first = 0; first < siblings.length; first++)
        for (let second = first + 1; second < siblings.length; second++) {
          const source = siblings[first];
          const target = siblings[second];
          const collision = overlapBetween(source, target, boxes, margin);
          if (!collision) continue;
          const sourceFixed = fixed(source);
          const targetFixed = fixed(target);
          if (sourceFixed && targetFixed) continue;
          const axis = collision.overlap.x <= collision.overlap.y ? "x" : "y";
          const sourceBox = boxes.get(source)!;
          const targetBox = boxes.get(target)!;
          const sign =
            axis === "x"
              ? sourceBox.x1 + sourceBox.x2 <= targetBox.x1 + targetBox.x2
                ? -1
                : 1
              : sourceBox.y1 + sourceBox.y2 <= targetBox.y1 + targetBox.y2
                ? -1
                : 1;
          const distance = collision.overlap[axis];
          if (!sourceFixed)
            move(source, axis, (sign * distance) / (targetFixed ? 1 : 2));
          if (!targetFixed)
            move(target, axis, (-sign * distance) / (sourceFixed ? 1 : 2));
          changed = true;
        }
    }
    iterations++;
    collisions = collisionsIn(
      groups,
      collisionBoxes(geometry, positions),
      margin,
    );
    if (!changed) break;
  }
  const movedNodeIds = [...positions]
    .filter(([id, position]) => {
      const previous = geometry.positions.get(id)!;
      return position.x !== previous.x || position.y !== previous.y;
    })
    .map(([id]) => id);
  return {
    positions,
    movedNodeIds,
    collisions,
    iterations,
    resolved: collisions.length === 0,
  };
}
