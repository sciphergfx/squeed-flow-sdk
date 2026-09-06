export function branchNodeIds(
  id: string,
  nodes: readonly { id: string; parent?: string }[],
  edges: readonly { source: string; target: string; inverted?: boolean }[],
): Set<string> {
  const ids = new Set([id]);
  const pending = [id];
  while (pending.length) {
    const parent = pending.pop()!;
    for (const node of nodes) {
      const child =
        node.parent === parent ||
        node.id.startsWith(`${parent}.`) ||
        edges.some(
          (edge) =>
            (edge.inverted ? edge.target : edge.source) === parent &&
            (edge.inverted ? edge.source : edge.target) === node.id,
        );
      if (child && !ids.has(node.id)) {
        ids.add(node.id);
        pending.push(node.id);
      }
    }
  }
  return ids;
}
