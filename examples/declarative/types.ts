import type { SqueedJson } from "../../src/core/squeedEdits";
import type { StateFormBinding } from "../../src/utils/formState";
import type { ResourceMapping } from "../workflow-state/resourceMapping";

export interface DiagramBindings {
  version: 1;
  title: string;
  exportAddress: string;
  nodes: Record<string, { address: string; type: string; label?: string; subtitle?: string[] }>;
  collection: {
    address: string; idField: string; typeField: string; propertiesField: string;
    labelField: string; subtitleFields: string[]; nodePrefix: string;
    types: Record<string, string>; fields?: StateFormBinding["fields"];
  };
  dependencies?: { field: string; sourceProperty: string; targetProperty: string; trigger?: string; labelField?: string };
  resources?: {
    field: string; registry: string; type: string; registryType: string;
    targetProperty: string; nodePrefix: string; sourceProperty: string;
    connectionPrefix?: string;
  }[];
}

export interface DiagramDesign {
  version: 1;
  root?: SqueedJson;
  defaults: SqueedJson;
  types: Record<string, SqueedJson>;
  nodes: Record<string, SqueedJson>;
  overrides?: Record<string, SqueedJson>;
  removedOverrides?: Record<string, string[]>;
  edgeOverrides?: Record<string, { set: SqueedJson; remove: string[] }>;
  canvas?: {
    direction?: "LR" | "RL" | "TB" | "BT" | "C";
    themeColor?: string;
    colorMode?: "light" | "dark";
    compactPropertyLayout?: boolean;
    nodeAlignment?: "leading" | "center" | "trailing";
    edgeType?: string;
    edgeRadius?: number;
    edgeMode?: "auto" | "nodes" | "properties" | "workflow";
  };
  groups?: { id: string; node: SqueedJson; members: string[] }[];
  hideParentEdges?: boolean;
  resourceMode?: "compact" | "split";
  mapping: ResourceMapping;
}

export interface DiagramPreset {
  id: string;
  label: string;
  design: Partial<DiagramDesign>;
}