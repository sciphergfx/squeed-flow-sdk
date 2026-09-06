import workflow from "./workflow.json";
import bindingJson from "./bindings.json";
import designJson from "./design.json";
import presetsJson from "./designs.json";
import { createConfiguredDiagram } from "../declarative/adapter";
import type { DiagramBindings, DiagramDesign, DiagramPreset } from "../declarative/types";

export const DIAGRAM_BINDINGS = bindingJson as DiagramBindings;
export const DIAGRAM_DESIGN = designJson as DiagramDesign;
export const DIAGRAM_SOURCE = { workflow };
export const DIAGRAM_PRESETS = presetsJson.presets as DiagramPreset[];
export const configuredDesign = (id: string): DiagramDesign => {
  const preset = DIAGRAM_PRESETS.find(entry => entry.id === id)?.design;
  if (!preset) throw new Error(`Unknown design: ${id}`);
  return { ...DIAGRAM_DESIGN, ...preset, types: { ...DIAGRAM_DESIGN.types, ...preset.types },
    nodes: { ...DIAGRAM_DESIGN.nodes, ...presetsJson.nodes, ...preset.nodes } };
};
export const CONFIGURED_EXAMPLES = Object.fromEntries(DIAGRAM_PRESETS.map(preset => [preset.id, {
  ...createConfiguredDiagram(DIAGRAM_SOURCE, DIAGRAM_BINDINGS, configuredDesign(preset.id)),
  ...preset, mapping: configuredDesign(preset.id).mapping,
}]));