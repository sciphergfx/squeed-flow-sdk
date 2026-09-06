interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const overlaps = (left: Bounds, right: Bounds) =>
  left.left < right.right &&
  left.right > right.left &&
  left.top < right.bottom &&
  left.bottom > right.top;

export function placeEdgeLabels(root: HTMLElement) {
  const layer = root.querySelector<SVGGElement>(".flow-sdk-labels");
  const matrix = layer?.getScreenCTM();
  if (!layer || !matrix) return;
  const inverse = matrix.inverse();
  const modelBounds = (element: Element, padding = 0): Bounds => {
    const bounds = element.getBoundingClientRect();
    const start = new DOMPoint(bounds.left, bounds.top).matrixTransform(
      inverse,
    );
    const end = new DOMPoint(bounds.right, bounds.bottom).matrixTransform(
      inverse,
    );
    return {
      left: start.x - padding,
      right: end.x + padding,
      top: start.y - padding,
      bottom: end.y + padding,
    };
  };
  const obstacles = [
    ...root.querySelectorAll<HTMLElement>(
      ".flow-sdk-node, .flow-sdk-node button",
    ),
  ]
    .filter((element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    })
    .map((element) => modelBounds(element, 24));
  for (const title of layer.querySelectorAll(".flow-sdk-container-label"))
    obstacles.push(modelBounds(title, 12));

  const labels = [
    ...layer.querySelectorAll<SVGGElement>(".flow-sdk-edge-label"),
  ];
  for (const label of labels)
    label.setAttribute("transform", label.dataset.labelTransform ?? "");
  const reserved = new Map(
    labels.map((label) => [label, modelBounds(label, 8)]),
  );
  const paths = new Map(
    [...root.querySelectorAll<SVGGElement>(".flow-sdk-edge")].map((edge) => [
      edge.dataset.edgeId,
      edge.querySelector<SVGPathElement>("path"),
    ]),
  );

  for (const label of labels) {
    const horizontal = label.dataset.labelHorizontal === "true";
    const preferred = reserved.get(label)!;
    reserved.delete(label);
    const blocked = (bounds: Bounds) =>
      obstacles.some((obstacle) => overlaps(bounds, obstacle)) ||
      [...reserved.values()].some((other) => overlaps(bounds, other));
    if (!horizontal && !blocked(preferred)) {
      reserved.set(label, preferred);
      continue;
    }
    const path = paths.get(label.dataset.edgeId);
    const mask = label.querySelector<SVGRectElement>("rect");
    if (!path || !mask) continue;
    const size = mask.getBBox();
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) continue;
    const centerX = (preferred.left + preferred.right) / 2;
    const centerY = (preferred.top + preferred.bottom) / 2;
    const count = Math.min(256, Math.max(16, Math.ceil(length / 24)));
    const pathPoints = Array.from({ length: count + 1 }, (_, index) => path.getPointAtLength(length * index / count));
    const candidates = Array.from({ length: count + 1 }, (_, index) => {
      const distance = (length * index) / count;
      const anchor = pathPoints[index];
      const point = horizontal ? { x: anchor.x, y: anchor.y - size.height / 2 - 15 } : anchor;
      const before = path.getPointAtLength(Math.max(0, distance - 2));
      const after = path.getPointAtLength(Math.min(length, distance + 2));
      let angle =
        (Math.atan2(after.y - before.y, after.x - before.x) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      const straight = Math.abs(angle) < 1;
      if (horizontal) angle = 0;
      const radians = (angle * Math.PI) / 180;
      const width =
        Math.abs(Math.cos(radians)) * size.width +
        Math.abs(Math.sin(radians)) * size.height;
      const height =
        Math.abs(Math.sin(radians)) * size.width +
        Math.abs(Math.cos(radians)) * size.height;
      return {
        point,
        angle,
        straight,
        score: Math.hypot(point.x - centerX, point.y - centerY),
        bounds: {
          left: point.x - width / 2 - 8,
          right: point.x + width / 2 + 8,
          top: point.y - height / 2 - 8,
          bottom: point.y + height / 2 + 8,
        },
      };
    }).sort((left, right) => left.score - right.score);
    const placement = candidates.find(
      (candidate) => !blocked(candidate.bounds) && (!horizontal || (candidate.straight && !pathPoints.some(point =>
        point.x > candidate.bounds.left && point.x < candidate.bounds.right &&
        point.y > candidate.bounds.top && point.y < candidate.bounds.bottom))),
    );
    if (placement) {
      label.setAttribute(
        "transform",
        `translate(${placement.point.x} ${placement.point.y}) rotate(${placement.angle})`,
      );
      reserved.set(label, placement.bounds);
    } else reserved.set(label, preferred);
  }
}
