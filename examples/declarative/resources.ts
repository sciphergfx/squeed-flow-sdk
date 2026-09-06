import { getNode } from "../../src/core/squeedEdits";
import type { createConfiguredDiagram } from "./adapter";
import type { DiagramBindings, DiagramDesign } from "./types";

export function projectConfiguredResources(result: ReturnType<typeof createConfiguredDiagram>, config: DiagramBindings, design: DiagramDesign) {
  const { state, view, bindings, entries } = result;
  for (const resource of config.resources ?? []) {
    const registry = resource.registry;
    if (!/^[A-Za-z0-9_]+$/.test(registry) || ["__proto__", "constructor", "prototype"].includes(registry)) throw new Error("Resource registry must be a safe simple key.");
    state[registry] = {};
    view[registry] = { $label: registry, $view: "icon-label", ...design.nodes[registry] };
    if (design.resourceMode === "split") {
      delete view[registry].$view;
      view[registry].$collapsed = false;
    } else {
      bindings[`root.${registry}`] = { address: "root", type: resource.registryType, resourceType: resource.type, portResources: {} };
      view[registry].$connections = [];
    }
    for (const entry of entries) {
      const names = getNode(entry.record, `root.${resource.field}`);
      if (names === undefined) continue;
      if (!Array.isArray(names) || names.some(name => typeof name !== "string")) throw new Error("Resource references must be a string array.");
      for (const name of names) {
        if (!/^[A-Za-z0-9_-]+$/.test(name) || ["__proto__", "constructor", "prototype"].includes(name)) throw new Error(`Invalid resource identity: ${name}`);
        state[registry][name] = { name };
        const key = design.resourceMode === "split" ? `${resource.nodePrefix}${name}` : registry;
        const sourceProperty = design.resourceMode === "split" ? resource.sourceProperty : `output:${name}`;
        if (design.resourceMode === "split") {
          view[key] ??= { ...design.defaults, ...design.nodes[registry], $label: name, $parent: `root.${registry}`, $hideParentEdge: true, $connections: [] };
          bindings[`root.${key}`] = { address: `root.${registry}.${name}`, type: resource.type };
        } else {
          view[registry][name] = name;
          bindings[`root.${registry}`].portResources![sourceProperty] = `root.${registry}.${name}`;
        }
        view[key].$connections.push({ id: `${resource.connectionPrefix ?? registry}:${name}:${entry.id}`, target: `root.${entry.key}`,
          sourceProperty, targetProperty: resource.targetProperty, style: "dashed" });
      }
    }
  }
}