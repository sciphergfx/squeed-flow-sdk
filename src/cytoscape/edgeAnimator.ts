type Entry = { edge: any; inverted: boolean };

// One rAF loop for every animated dashed edge on the page (was one loop per edge)
const entries = new Map<object, Entry>();
let rafId: number | null = null;

const SPEED = 0.1;
const PERIOD = 20 * 50;

function tick() {
  rafId = null;
  const offsetBase = (Date.now() * SPEED) % PERIOD;
  const cys = new Set<any>();
  for (const { edge } of entries.values()) {
    if (!edge.removed()) cys.add(edge.cy());
  }
  cys.forEach((cy) => cy.startBatch());
  for (const { edge, inverted } of entries.values()) {
    if (edge.removed()) continue;
    edge.style("line-dash-offset", inverted ? offsetBase : -offsetBase);
  }
  cys.forEach((cy) => cy.endBatch());
  if (entries.size) rafId = requestAnimationFrame(tick);
}

/** Pass `edge` to (re)register under `key`, or `null` to unregister. */
export function setEdgeAnimation(
  key: object,
  edge: any | null,
  inverted = false,
) {
  if (edge) {
    entries.set(key, { edge, inverted });
    if (rafId === null) rafId = requestAnimationFrame(tick);
    return;
  }
  entries.delete(key);
  if (!entries.size && rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
