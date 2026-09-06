interface FocusNode {
  id: string;
  parent?: string;
}
interface FocusEdge {
  source: string;
  target: string;
}

export function connectedNodeIds(
  id: string,
  nodes: readonly FocusNode[],
  edges: readonly FocusEdge[],
): Set<string> {
  const available = new Set(nodes.map((node) => node.id));
  if (!available.has(id)) return new Set();
  const group = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (
        !group.has(node.id) &&
        (group.has(node.parent ?? "") || node.id.startsWith(`${id}.`))
      ) {
        group.add(node.id);
        changed = true;
      }
    }
  }
  const connected = new Set(group);
  for (const edge of edges) {
    if (group.has(edge.source) && available.has(edge.target))
      connected.add(edge.target);
    if (group.has(edge.target) && available.has(edge.source))
      connected.add(edge.source);
  }
  return connected;
}
