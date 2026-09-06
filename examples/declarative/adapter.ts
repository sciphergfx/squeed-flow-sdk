import { getNode, type SqueedJson } from "../../src/core/squeedEdits";
import type { StateFormBinding } from "../../src/utils/formState";
import type { WorkflowDependencyMapping } from "../workflow-state/dependencies";
import type { DiagramBindings, DiagramDesign } from "./types";
import { projectConfiguredResources } from "./resources";
import { validateConfiguration } from "./configuration";

export function fieldValue(record: unknown, field: string) {
  return field ? getNode(record as SqueedJson, `root.${field}`) : record;
}

export function createConfiguredDiagram(source: SqueedJson, config: DiagramBindings, design: DiagramDesign) {
  validateConfiguration(config, design);
  const registries = new Set<string>();
  for (const resource of config.resources ?? []) {
    if (Object.hasOwn(source, resource.registry) || registries.has(resource.registry)) throw new Error(`Generated registry conflicts with source data: ${resource.registry}`);
    registries.add(resource.registry);
  }
  const state = structuredClone(source);
  const collection = config.collection;
  const records = getNode(state, collection.address);
  if (!records || typeof records !== "object") throw new Error(`Collection not found: ${collection.address}`);
  const view: SqueedJson = { $label: getNode(state, config.title), ...design.root };
  const bindings: Record<string, StateFormBinding> = {};
  const identities: Record<string, string> = {};
  const entries: { id: string; key: string; address: string; record: SqueedJson }[] = [];
  const subtitle = (record: unknown, fields: string[]) => fields.map(field => fieldValue(record, field)).find(value => value !== undefined && value !== null);
  const node = (key: string, type = "") => ({ ...design.defaults, ...design.types[type], ...design.nodes[key] });
  for (const [key, binding] of Object.entries(config.nodes)) {
    if (!/^[A-Za-z0-9_%-]+$/.test(key)) throw new Error(`Invalid node key: ${key}`);
    const record = getNode(state, binding.address);
    if (!record) throw new Error(`Binding not found: ${binding.address}`);
    view[key] = { ...node(key), ...(binding.label ? { $label: { $state: `${binding.address}.${binding.label}` } } : {}),
      ...(binding.subtitle ? { $subtitle: subtitle(record, binding.subtitle) } : {}) };
    bindings[`root.${key}`] = { address: binding.address, type: binding.type };
  }
  for (const resource of config.resources ?? []) view[resource.registry] = structuredClone(design.nodes[resource.registry] ?? {});
  const seen = new Set<string>();
  for (const [index, record] of Object.entries(records)) {
    if (!/^[A-Za-z0-9_-]+$/.test(index) || !record || typeof record !== "object" || Array.isArray(record)) throw new Error("Collection entries must be objects with safe keys.");
    const rawId = fieldValue(record, collection.idField);
    if (typeof rawId !== "string" || !rawId || seen.has(rawId)) throw new Error("Collection identities must be unique nonempty strings.");
    seen.add(rawId);
    const id = rawId;
    const key = `${collection.nodePrefix}${encodeURIComponent(id).replace(/\./g, "%2E")}`;
    if (!/^[A-Za-z0-9_%-]+$/.test(key) || Object.hasOwn(view, key)) throw new Error(`Duplicate or invalid node key: ${key}`);
    const kind = String(fieldValue(record, collection.typeField) ?? "");
    const type = Object.hasOwn(collection.types, kind) ? collection.types[kind] : undefined;
    if (!type) throw new Error(`Choose a properties interface for ${kind || "this collection"}.`);
    const address = `${collection.address}.${index}`;
    view[key] = { ...node(key, kind), $label: { $state: `${address}.${collection.labelField}` }, $subtitle: subtitle(record, collection.subtitleFields) };
    if (design.hideParentEdges) view[key].$hideParentEdge = true;
    bindings[`root.${key}`] = { address: collection.propertiesField ? `${address}.${collection.propertiesField}` : address,
      type, ...(collection.fields ? { fields: structuredClone(collection.fields) } : {}) };
    identities[`root.${key}`] = id;
    entries.push({ id, key, address, record });
  }
  for (const [key, value] of Object.entries(design.nodes)) if (!Object.hasOwn(view, key)) view[key] = structuredClone(value);
  const dependencies = config.dependencies;
  const dependencyMapping: WorkflowDependencyMapping | undefined = dependencies && {
    stepsAddress: collection.address, nodes: identities, sourceProperty: dependencies.sourceProperty,
    targetProperty: dependencies.targetProperty, idField: collection.idField, dependencyField: dependencies.field,
  };
  if (dependencies) {
    const keyById = new Map(entries.map(entry => [entry.id, entry.key]));
    for (const entry of entries) {
      const values = fieldValue(entry.record, dependencies.field);
      if (values !== undefined && (!Array.isArray(values) || values.some(value => typeof value !== "string"))) throw new Error("Dependencies must be an array of identities.");
      const sources = values?.length ? values.map(id => keyById.get(id)).filter(Boolean) : dependencies.trigger ? [dependencies.trigger] : [];
      for (const sourceKey of sources) {
        if (!view[sourceKey]) continue;
        const condition = dependencies.labelField && fieldValue(entry.record, dependencies.labelField);
        view[sourceKey].$connections = [...(view[sourceKey].$connections ?? []), {
          id: `depends:${sourceKey}:${entry.id}`, target: `root.${entry.key}`,
          sourceProperty: dependencies.sourceProperty, targetProperty: dependencies.targetProperty,
          ...(condition ? { label: condition } : {}),
        }];
      }
    }
  }
  const result = { state, view, bindings, dependencyMapping, entries };
  projectConfiguredResources(result, config, design);
  for (const group of design.groups ?? []) {
    if (!/^[A-Za-z0-9_%-]+$/.test(group.id) || ["__proto__", "constructor", "prototype"].includes(group.id) || entries.some(entry => entry.key === group.id) || Object.hasOwn(config.nodes, group.id)) throw new Error("Group identity conflicts with a mapped node.");
    view[group.id] = structuredClone(group.node);
    for (const member of group.members) if (view[member]) view[member].$parent = `root.${group.id}`;
  }
  return result;
}