import { getNode, type SqueedJson } from "../../src/core/squeedEdits";
import { applyStateEdits } from "../../src/utils/formState";
import type { SqueedConnection } from "../../src/types";

export interface WorkflowDependencyMapping {
  stepsAddress: string;
  nodes: Record<string, string>;
  sourceProperty: string;
  targetProperty: string;
  idField?: string;
  dependencyField?: string;
}

export function reconcileWorkflowDependencies(
  view: SqueedJson,
  previousView: SqueedJson,
  state: SqueedJson,
  mapping?: WorkflowDependencyMapping,
): SqueedJson {
  if (!mapping) return state;
  const steps = getNode(state, mapping.stepsAddress);
  if (!steps || typeof steps !== "object") return state;
  const entries = Object.entries(steps);
  const idField = mapping.idField ?? "id";
  const dependencyField = mapping.dependencyField ?? "dependsOn";
  const identity = (step: SqueedJson) => getNode(step, `root.${idField}`);
  const stepIds = new Set(entries.map(([, step]) => identity(step)));
  const incoming = (document: SqueedJson) => {
    const result = new Map<string, Set<string>>();
    for (const [address, sourceId] of Object.entries(mapping.nodes)) {
      const node = getNode(document, address);
      if (!node || !stepIds.has(sourceId)) continue;
      const connections: SqueedConnection[] = [
        ...(Array.isArray(node.$connections) ? node.$connections : []),
      ];
      if (typeof node.$target === "string")
        connections.push({ target: node.$target });
      for (const connection of connections) {
        const executionLink =
          connection.sourceProperty === mapping.sourceProperty &&
          connection.targetProperty === mapping.targetProperty;
        const nodeLink =
          connection.sourceProperty === undefined &&
          connection.targetProperty === undefined;
        if (
          (!executionLink && !nodeLink) ||
          !Object.hasOwn(mapping.nodes, connection.target) ||
          !getNode(document, connection.target)
        )
          continue;
        const targetId = mapping.nodes[connection.target];
        if (!stepIds.has(targetId)) continue;
        const sources = result.get(targetId) ?? new Set<string>();
        sources.add(sourceId);
        result.set(targetId, sources);
      }
    }
    return result;
  };
  const previous = incoming(previousView);
  const current = incoming(view);
  let next = state;
  for (const [index, step] of entries) {
    const before = previous.get(identity(step)) ?? new Set<string>();
    const after = current.get(identity(step)) ?? new Set<string>();
    const removed = new Set([...before].filter((id) => !after.has(id)));
    const added = [...after].filter((id) => !before.has(id));
    if (!removed.size && !added.length) continue;
    const value = getNode(step, `root.${dependencyField}`);
    const existing: string[] = Array.isArray(value) ? value : [];
    const dependsOn = existing.filter((id) => !removed.has(id));
    for (const id of added) if (!dependsOn.includes(id)) dependsOn.push(id);
    if (JSON.stringify(existing) !== JSON.stringify(dependsOn)) {
      next = applyStateEdits(next, [
        {
          op: "set",
          address: `${mapping.stepsAddress}.${index}.${dependencyField}`,
          value: dependsOn,
        },
      ]);
    }
  }
  return next;
}
