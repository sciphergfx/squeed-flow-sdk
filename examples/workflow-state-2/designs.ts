import { createConfiguredDiagram } from "../declarative/adapter";
import {
  DIAGRAM_SOURCE,
  DIAGRAM_BINDINGS,
  DIAGRAM_PRESETS,
  CONFIGURED_EXAMPLES,
  configuredDesign,
} from "./configured";

export const CAST_DESIGNS = DIAGRAM_PRESETS.map((preset) => ({
  ...preset,
  mapping: configuredDesign(preset.id).mapping,
}));

export type CastDesignId = (typeof CAST_DESIGNS)[number]["id"];

export function createCastDesign(id: CastDesignId) {
  const preset = CAST_DESIGNS.find((entry) => entry.id === id);
  if (!preset) throw new Error(`Unknown design: ${id}`);
  return {
    ...createConfiguredDiagram(
      DIAGRAM_SOURCE,
      DIAGRAM_BINDINGS,
      configuredDesign(id),
    ),
    ...preset,
  };
}

export const CAST_DESIGN_EXAMPLES = CONFIGURED_EXAMPLES;
