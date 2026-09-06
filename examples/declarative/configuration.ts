import { getNode, type SqueedJson } from "../../src/core/squeedEdits";
import type { FormSchema } from "../../src/core/forms";
import { validateResourceMapping } from "../workflow-state/resourceMapping";
import type { DiagramBindings, DiagramDesign } from "./types";
import { validateConfigurationShape } from "./validation";

export function configurationPaths(value: unknown, prefix = "root", depth = 0): string[] {
  if (!value || typeof value !== "object" || depth > 6) return [prefix];
  if (Array.isArray(value)) return [prefix];
  return [prefix, ...Object.entries(value).flatMap(([key, child]) =>
    /^[A-Za-z0-9_-]+$/.test(key) && !["__proto__", "constructor", "prototype"].includes(key)
      ? configurationPaths(child, `${prefix}.${key}`, depth + 1) : [])];
}

export function parseConfiguration(text: string): unknown {
  if (text.length > 1024 * 1024) throw new Error("Configuration exceeds 1 MB.");
  return JSON.parse(text, (key, value) => {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Unsafe configuration key.");
    return value;
  });
}

export function validateConfiguration(bindings: DiagramBindings, design: DiagramDesign, schema?: FormSchema) {
  validateConfigurationShape(bindings, design, schema);
  const paths = [bindings.title, bindings.exportAddress, bindings.collection.address, bindings.collection.idField,
    bindings.collection.typeField, bindings.collection.propertiesField, bindings.collection.labelField,
    ...bindings.collection.subtitleFields, ...Object.values(bindings.nodes).flatMap(node => [node.address, node.label ?? "", ...(node.subtitle ?? [])]),
    bindings.dependencies?.field ?? "", bindings.dependencies?.labelField ?? "", ...(bindings.resources ?? []).map(resource => resource.field)];
  for (const path of paths) if (typeof path !== "string" || path.split(".").some(key => ["__proto__", "constructor", "prototype"].includes(key))) throw new Error("Invalid binding path.");
  if (schema) {
    const types = [...Object.values(bindings.collection.types), ...Object.values(bindings.nodes).map(node => node.type), ...(bindings.resources ?? []).flatMap(resource => [resource.type, resource.registryType])];
    for (const type of types) if (!Object.hasOwn(schema, type)) throw new Error(`Interface not found: ${type}`);
    validateResourceMapping(design.mapping, schema);
  }
}

export function captureConfiguredDesign(design: DiagramDesign, view: SqueedJson, baseView?: SqueedJson): DiagramDesign {
  const overrides: Record<string, SqueedJson> = {};
  const removedOverrides: Record<string, string[]> = {};
  const edgeOverrides: NonNullable<DiagramDesign["edgeOverrides"]> = {};
  const editable = (field: string) => field.startsWith("$") && !["$connections", "$ports", "$target", "$hideParentEdge"].includes(field);
  for (const [key, node] of Object.entries(view)) {
    if (key.startsWith("$") || !node || typeof node !== "object") continue;
    const properties = Object.fromEntries(Object.entries(node).filter(([field, value]) =>
      editable(field) && (!baseView || JSON.stringify(value) !== JSON.stringify(baseView[key]?.[field])) &&
      !(value && typeof value === "object" && "$state" in value)));
    if (Object.keys(properties).length) overrides[key] = properties;
    const removed = Object.keys(baseView?.[key] ?? {}).filter(field => editable(field) && !Object.hasOwn(node, field));
    if (removed.length) removedOverrides[key] = removed;
    for (const connection of node.$connections ?? []) {
      const identity = connectionIdentity(key, connection);
      const base = baseView?.[key]?.$connections?.find(candidate => connectionIdentity(key, candidate) === identity) ?? {};
      const fields = ["label", "color", "style", "type", "icon", "animationVariant"];
      const set = Object.fromEntries(fields.filter(field => Object.hasOwn(connection, field) && JSON.stringify(connection[field]) !== JSON.stringify(base[field])).map(field => [field, connection[field]]));
      const remove = fields.filter(field => Object.hasOwn(base, field) && !Object.hasOwn(connection, field));
      if (Object.keys(set).length || remove.length) edgeOverrides[identity] = { set, remove };
    }
  }
  return { ...design, overrides, removedOverrides, edgeOverrides };
}

function connectionIdentity(source: string, connection: { target: string; sourceProperty?: string; targetProperty?: string }) {
  return JSON.stringify([source, connection.target, connection.sourceProperty, connection.targetProperty]);
}

export function applyConfiguredAppearance(view: SqueedJson, design: DiagramDesign): SqueedJson {
  const next = { ...view };
  for (const [key, properties] of Object.entries(design.overrides ?? {})) if (Object.hasOwn(next, key)) next[key] = { ...next[key], ...properties };
  for (const [key, fields] of Object.entries(design.removedOverrides ?? {})) if (Object.hasOwn(next, key)) {
    next[key] = { ...next[key] };
    for (const field of fields) delete next[key][field];
  }
  for (const [key, node] of Object.entries(next)) if (Array.isArray(node?.$connections)) {
    next[key] = { ...node, $connections: node.$connections.map(connection => {
      const override = design.edgeOverrides?.[connectionIdentity(key, connection)];
      if (!override) return connection;
      const result = { ...connection, ...override.set };
      for (const field of override.remove) delete result[field];
      return result;
    }) };
  }
  return next;
}

export function exportConfiguredSource(state: SqueedJson, bindings: DiagramBindings) {
  const result = getNode(state, bindings.exportAddress);
  if (result === undefined) throw new Error(`Export address not found: ${bindings.exportAddress}`);
  if (bindings.exportAddress !== "root") return structuredClone(result);
  return sourceWithoutRegistries(state, bindings);
}

export function sourceWithoutRegistries(state: SqueedJson, bindings: DiagramBindings): SqueedJson {
  const next = structuredClone(state);
  for (const resource of bindings.resources ?? []) delete next[resource.registry];
  return next;
}