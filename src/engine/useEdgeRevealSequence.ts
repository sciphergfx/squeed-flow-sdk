import { useCallback, useLayoutEffect, useMemo, useState } from "react";

type Edge = { id: string; source: string; target: string; inverted?: boolean };
type Progress = { nodes: Set<string>; edges: Set<string> };

export function useEdgeRevealSequence(nodes: readonly { id: string }[], edges: readonly Edge[], enabled: boolean) {
  const [progress, setProgress] = useState<Progress>(() => ({ nodes: new Set(), edges: new Set() }));
  const sequence = useMemo(() => {
    const ids = new Set(nodes.map((node) => node.id));
    const links = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({
      id: edge.id,
      source: edge.inverted ? edge.target : edge.source,
      target: edge.inverted ? edge.source : edge.target,
    }));
    const edgeIds = new Set(links.map((edge) => edge.id));
    const shown = new Set([...progress.nodes].filter((id) => ids.has(id)));
    const finished = new Set([...progress.edges].filter((id) => edgeIds.has(id)));
    if (!enabled) return { nodes: ids, edges: edgeIds, ready: edgeIds };
    for (const node of nodes) {
      const incoming = links.filter((edge) => edge.target === node.id && edge.source !== edge.target);
      if (incoming.every((edge) => finished.has(edge.id))) shown.add(node.id);
    }
    let ready = new Set(links.filter((edge) => shown.has(edge.source)).map((edge) => edge.id));
    if (shown.size < ids.size && !links.some((edge) => ready.has(edge.id) && !finished.has(edge.id))) {
      const seed = nodes.find((node) => !shown.has(node.id));
      if (seed) shown.add(seed.id);
      ready = new Set(links.filter((edge) => shown.has(edge.source)).map((edge) => edge.id));
    }
    return { nodes: shown, edges: finished, ready };
  }, [nodes, edges, enabled, progress]);
  useLayoutEffect(() => {
    setProgress((previous) => {
      const next = enabled ? sequence : { nodes: new Set<string>(), edges: new Set<string>() };
      const equal = (first: Set<string>, second: Set<string>) => first.size === second.size && [...first].every((id) => second.has(id));
      return equal(previous.nodes, next.nodes) && equal(previous.edges, next.edges) ? previous : { nodes: next.nodes, edges: next.edges };
    });
  }, [sequence, enabled]);
  const complete = useCallback((id: string) => {
    setProgress((previous) => previous.edges.has(id) ? previous : { ...previous, edges: new Set([...previous.edges, id]) });
  }, []);
  return { shown: sequence.nodes, ready: sequence.ready, complete };
}