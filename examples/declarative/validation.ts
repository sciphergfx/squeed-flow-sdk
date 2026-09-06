import type { FormSchema } from "../../src/core/forms";
import type { DiagramBindings, DiagramDesign } from "./types";

const object = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const safeKey = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9_%-]+$/.test(value) &&
  !["__proto__", "prototype", "constructor"].includes(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const appearanceFields = new Set([
  "$label",
  "$subtitle",
  "$content",
  "$icon",
  "$bgColor",
  "$textColor",
  "$borderColor",
  "$borderRadius",
  "$borderWidth",
  "$borderStyle",
  "$fontSize",
  "$view",
  "$outline",
  "$collapsed",
  "$parent",
  "$isNodeAnimated",
  "$nodeAnimationVariant",
  "$sourceLabel",
  "$targetLabel",
  "$edgeLabel",
  "$edgeColor",
  "$edgeType",
  "$edgeIcon",
  "$targetIcon",
  "$targetEdgeType",
  "$isEdgeAnimated",
  "$isEdgeDashed",
  "$edgeAnimationVariant",
  "$targetAnimationVariant",
  "$hideRoot",
  "$hideParentEdge",
]);
const edgeFields = new Set([
  "label",
  "color",
  "style",
  "type",
  "icon",
  "animationVariant",
]);

export function validateConfigurationShape(
  bindings: DiagramBindings,
  design: DiagramDesign,
  schema?: FormSchema,
) {
  if (
    !object(bindings) ||
    !object(design) ||
    bindings.version !== 1 ||
    design.version !== 1 ||
    !object(bindings.collection) ||
    !object(bindings.nodes) ||
    !object(design.nodes) ||
    !object(design.types) ||
    !object(design.defaults)
  )
    throw new Error("Expected version 1 design and binding definitions.");
  if (
    !object(bindings.collection.types) ||
    !Object.values(bindings.collection.types).every(
      (type) => typeof type === "string",
    ) ||
    !strings(bindings.collection.subtitleFields)
  )
    throw new Error("Invalid collection interface mapping.");
  for (const [key, binding] of Object.entries(bindings.nodes))
    if (
      !safeKey(key) ||
      !object(binding) ||
      typeof binding.type !== "string" ||
      (binding.subtitle !== undefined && !strings(binding.subtitle))
    )
      throw new Error("Invalid node binding.");
  if (
    bindings.dependencies &&
    (!object(bindings.dependencies) ||
      !/^output:.+/.test(bindings.dependencies.sourceProperty) ||
      !/^input:.+/.test(bindings.dependencies.targetProperty))
  )
    throw new Error("Choose valid dependency input and output ports.");
  if (bindings.resources !== undefined && !Array.isArray(bindings.resources))
    throw new Error("Resources must be an array.");
  for (const resource of bindings.resources ?? [])
    if (
      !object(resource) ||
      !safeKey(resource.registry) ||
      !safeKey(resource.nodePrefix) ||
      typeof resource.type !== "string" ||
      typeof resource.registryType !== "string" ||
      !/^output:.+/.test(resource.sourceProperty) ||
      !/^config:.+/.test(resource.targetProperty)
    )
      throw new Error("Invalid resource registry mapping.");
  if (
    !object(design.mapping) ||
    design.mapping.version !== 1 ||
    !Array.isArray(design.mapping.fields)
  )
    throw new Error("Invalid reusable-field mapping.");
  if (design.groups !== undefined && !Array.isArray(design.groups))
    throw new Error("Groups must be an array.");
  for (const group of design.groups ?? [])
    if (
      !object(group) ||
      !safeKey(group.id) ||
      !object(group.node) ||
      !strings(group.members)
    )
      throw new Error("Invalid group definition.");
  for (const entries of [design.nodes, design.types, design.overrides ?? {}]) {
    if (!object(entries)) throw new Error("Invalid appearance mapping.");
    for (const [key, properties] of Object.entries(entries)) {
      if (!safeKey(key) || !object(properties))
        throw new Error("Invalid appearance definition.");
      if (
        entries === design.overrides &&
        Object.keys(properties).some((field) => !appearanceFields.has(field))
      )
        throw new Error(
          "Appearance overrides cannot change connections or source data.",
        );
    }
  }
  for (const [key, fields] of Object.entries(design.removedOverrides ?? {}))
    if (
      !safeKey(key) ||
      !strings(fields) ||
      fields.some((field) => !appearanceFields.has(field))
    )
      throw new Error("Invalid appearance reset.");
  for (const override of Object.values(design.edgeOverrides ?? {}))
    if (
      !object(override) ||
      !object(override.set) ||
      !strings(override.remove) ||
      [...Object.keys(override.set), ...override.remove].some(
        (field) => !edgeFields.has(field),
      )
    )
      throw new Error("Edge appearance cannot change endpoints.");
  const canvas = design.canvas;
  if (canvas) {
    if (!object(canvas)) throw new Error("Invalid canvas settings.");
    for (const [field, allowed] of Object.entries({
      direction: ["LR", "RL", "TB", "BT", "C"],
      colorMode: ["light", "dark"],
      nodeAlignment: ["leading", "center", "trailing"],
      edgeMode: ["auto", "nodes", "properties", "workflow"],
    })) {
      if (canvas[field] !== undefined && !allowed.includes(canvas[field]))
        throw new Error(`Invalid canvas ${field}.`);
    }
    if (
      canvas.edgeRadius !== undefined &&
      (!Number.isFinite(canvas.edgeRadius) || canvas.edgeRadius < 0)
    )
      throw new Error("Invalid edge radius.");
  }
  if (schema)
    for (const [name, type] of Object.entries(schema)) {
      if (
        !safeKey(name) ||
        !object(type) ||
        type.kind !== "object" ||
        !object(type.properties)
      )
        throw new Error("Invalid properties interface schema.");
    }
}
