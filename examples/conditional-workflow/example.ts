import source from "./source.json";
import { DIAGRAM_BINDINGS } from "../workflow-state-2/configured";
import type { DiagramBindings, DiagramDesign } from "../declarative/types";

export const CONDITIONAL_SOURCE = source;
export const CONDITIONAL_BINDINGS: DiagramBindings = {
  ...DIAGRAM_BINDINGS,
  collection: {
    ...DIAGRAM_BINDINGS.collection,
    types: {
      conditional: "ConditionalConfig",
      spawn_workflow: "WorkflowCallConfig",
      output: "ConditionalOutputConfig",
    },
    fields: {},
  },
  resources: [],
};
export const CONDITIONAL_DESIGN: DiagramDesign = {
  version: 1,
  root: { $hideRoot: true },
  defaults: { $view: "icon-label" },
  hideParentEdges: true,
  types: {
    conditional: { $icon: "PiGitBranch", $bgColor: "yellow.600" },
    spawn_workflow: { $icon: "PiFlowArrow", $bgColor: "teal.600" },
    output: { $icon: "PiStopCircle", $bgColor: "gray.600" },
  },
  nodes: { trigger: { $icon: "PiPlay", $bgColor: "blue.600" } },
  mapping: { version: 1, fields: [] },
  canvas: { edgeMode: "properties" },
};
export const conditionalDesign = (_id: string) => CONDITIONAL_DESIGN;
