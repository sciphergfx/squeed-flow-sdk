import type { TaxiDir } from "./geometry";
import type { Box } from "./types";

interface BranchEdge {
  id: string;
  source: string;
  target: string;
  sourceProperty?: string;
  targetProperty?: string;
}

export interface BranchRoute {
  turn: number;
  labelAtTarget: boolean;
}

export function branchRoutes(
  edges: BranchEdge[],
  boxFor: (id: string) => Box | undefined | null,
  direction: TaxiDir,
): Map<string, BranchRoute> {
  const vertical = direction === "downward" || direction === "upward";
  const groups = new Map<string, { edge: BranchEdge; gap: number; cross: number }[]>();
  for (const edge of edges) {
    if (edge.source === edge.target || edge.sourceProperty || edge.targetProperty)
      continue;
    const source = boxFor(edge.source);
    const target = boxFor(edge.target);
    if (!source || !target) continue;
    const delta = vertical ? target.y - source.y : target.x - source.x;
    const gap = Math.abs(delta) - (vertical ? source.h + target.h : source.w + target.w) / 2;
    if (gap <= 320) continue;
    const key = JSON.stringify([edge.source, Math.sign(delta)]);
    const group = groups.get(key) ?? [];
    group.push({ edge, gap, cross: vertical ? target.x : target.y });
    groups.set(key, group);
  }

  const routes = new Map<string, BranchRoute>();
  for (const group of groups.values()) {
    if (new Set(group.map(({ edge }) => edge.target)).size < 2) continue;
    group.sort((left, right) => left.cross - right.cross || left.edge.id.localeCompare(right.edge.id));
    const commonGap = Math.min(...group.map(({ gap }) => gap));
    const targetCounts = new Map<string, number>();
    for (const { edge } of group)
      targetCounts.set(edge.target, (targetCounts.get(edge.target) ?? 0) + 1);
    group.forEach(({ edge, gap }, index) => {
      const distance = 120 + (commonGap - 280) * (index + 1) / (group.length + 1);
      routes.set(edge.id, {
        turn: distance / gap,
        labelAtTarget: targetCounts.get(edge.target) === 1,
      });
    });
  }
  return routes;
}