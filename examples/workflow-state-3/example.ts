import { configuredDesign, DIAGRAM_SOURCE, DIAGRAM_BINDINGS } from "../workflow-state-2/configured";
import type { DiagramDesign } from "../declarative/types";
import type { SqueedJson } from "../../src/core/squeedEdits";

export { DIAGRAM_SOURCE, DIAGRAM_BINDINGS };

export function iconLabelView(view: SqueedJson, previous?: SqueedJson): SqueedJson {
  const parentIds = new Set(Object.values(view).flatMap(node => typeof node?.$parent === "string" ? [node.$parent] : []));
  return Object.fromEntries(Object.entries(view).map(([key, value]) => {
    if (key.startsWith("$") || !value || typeof value !== "object" || Array.isArray(value)) return [key, value];
    if (previous && Object.hasOwn(previous, key)) return [key, value];
    return [key, { ...value, $view: "icon-label", $icon: value.$icon || "PiBracketsCurly",
      ...(parentIds.has(`root.${key}`) ? { $collapsed: true } : {}) }];
  }));
}

export function iconLabelDesign(id: string): DiagramDesign {
  const design = configuredDesign(id);
  return { ...design, defaults: { ...design.defaults, $view: "icon-label" },
    nodes: iconLabelView(design.nodes) as DiagramDesign["nodes"],
    groups: design.groups?.map(group => ({ ...group, node: { ...group.node, $view: "icon-label", $collapsed: true } })),
    canvas: { ...design.canvas, edgeMode: "properties" },
  };
}