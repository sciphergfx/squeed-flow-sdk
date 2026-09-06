import type { FormSchema } from "../../src/core/forms";
import {
  getNode,
  removeNode,
  setNodeProp,
  type SqueedJson,
} from "../../src/core/squeedEdits";
import {
  applyStateEdits,
  type StateFormBinding,
} from "../../src/utils/formState";
import type { TemplateGraph } from "./templateReferences";

export interface ReusableField {
  type: string;
  field: string;
  createEmpty?: boolean;
}

export interface ResourceMapping {
  version: 1;
  fields: ReusableField[];
  templates?: boolean;
}

interface ResourceSlot extends ReusableField {
  address: string;
  nodeAddress: string;
}

export interface MappedConfiguration {
  mapping: ResourceMapping;
  state: SqueedJson;
  view: SqueedJson;
  slots: ResourceSlot[];
  templateGraph?: TemplateGraph;
}

export const EMPTY_RESOURCE_MAPPING: ResourceMapping = {
  version: 1,
  fields: [],
};
const registry = "sdkResources";
const resourceType = ({ type, field }: ReusableField) =>
  `Reusable_${type.length}_${type}_${field}`;
const fieldKey = ({ type, field }: ReusableField) =>
  JSON.stringify([type, field]);
const resourceId = (slot: ResourceSlot) =>
  `resource_${encodeURIComponent(JSON.stringify([slot.nodeAddress, slot.type, slot.field])).replace(/\./g, "%2E")}`;

export function validateResourceMapping(
  value: unknown,
  schema: FormSchema,
): ResourceMapping {
  const mapping = value as ResourceMapping;
  if (
    !mapping ||
    mapping.version !== 1 ||
    !Array.isArray(mapping.fields) ||
    mapping.fields.length > 128
  )
    throw new Error(
      "Expected a version 1 resource mapping with at most 128 fields.",
    );
  if (mapping.templates !== undefined && typeof mapping.templates !== "boolean")
    throw new Error("templates must be a boolean.");
  const seen = new Set<string>();
  const fields = mapping.fields.map((entry) => {
    if (
      !entry ||
      typeof entry.type !== "string" ||
      typeof entry.field !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.field) ||
      ["__proto__", "prototype", "constructor"].includes(entry.field) ||
      !Object.hasOwn(schema, entry.type) ||
      !Object.hasOwn(schema[entry.type].properties, entry.field)
    )
      throw new Error(
        "Choose an existing interface field for each resource mapping.",
      );
    if (schema[entry.type].ports?.[entry.field])
      throw new Error(`${entry.type}.${entry.field} already declares a port.`);
    const key = fieldKey(entry);
    if (seen.has(key))
      throw new Error(
        `Duplicate resource mapping: ${entry.type}.${entry.field}`,
      );
    seen.add(key);
    if (
      entry.createEmpty !== undefined &&
      typeof entry.createEmpty !== "boolean"
    )
      throw new Error("createEmpty must be a boolean.");
    return {
      type: entry.type,
      field: entry.field,
      ...(entry.createEmpty !== undefined
        ? { createEmpty: entry.createEmpty }
        : {}),
    };
  });
  return {
    version: 1,
    fields,
    ...(mapping.templates !== undefined
      ? { templates: mapping.templates }
      : {}),
  };
}

function resolveSlots(state: SqueedJson, slots: ResourceSlot[]) {
  let next = state;
  for (const slot of slots) {
    const reference = getNode(state, slot.address);
    if (reference === undefined) continue;
    const resource =
      typeof reference === "string" && state[registry]?.[reference];
    if (!resource || resource.type !== resourceType(slot))
      throw new Error(`Unresolved reusable configuration at ${slot.address}.`);
    next = applyStateEdits(next, [
      resource.value === undefined
        ? { op: "remove", address: slot.address }
        : {
            op: "set",
            address: slot.address,
            value: structuredClone(resource.value),
          },
    ]);
  }
  return next;
}

export function exportResourceState(document: MappedConfiguration): SqueedJson {
  const state = resolveSlots(document.state, document.slots);
  if (!Object.hasOwn(state, registry)) return state;
  const next = { ...state };
  delete next[registry];
  return next;
}

export function configureResources(
  input: {
    state: SqueedJson;
    view: SqueedJson;
    schema: FormSchema;
    bindings: Record<string, StateFormBinding>;
  },
  value: ResourceMapping,
  previous?: MappedConfiguration,
): MappedConfiguration {
  const mapping = validateResourceMapping(value, input.schema);
  if (
    !previous &&
    mapping.fields.length &&
    (Object.hasOwn(input.state, registry) ||
      Object.hasOwn(input.view, registry))
  )
    throw new Error("sdkResources is reserved for mapped configuration.");
  const enabled = new Set(mapping.fields.map(fieldKey));
  const existing = new Set(previous?.mapping.fields.map(fieldKey));
  const removed =
    previous?.mapping.fields.filter((field) => !enabled.has(fieldKey(field))) ??
    [];
  const removedTypes = new Set(removed.map(resourceType));
  let state = resolveSlots(
    previous?.state ?? input.state,
    previous?.slots.filter((slot) => !enabled.has(fieldKey(slot))) ?? [],
  );
  let view = previous?.view ?? input.view;
  const slots =
    previous?.slots.filter((slot) => enabled.has(fieldKey(slot))) ?? [];
  for (const [id, resource] of Object.entries(state[registry] ?? {}) as [
    string,
    { type: string },
  ][]) {
    if (!removedTypes.has(resource.type)) continue;
    state = applyStateEdits(state, [
      { op: "remove", address: `root.${registry}.${id}` },
    ]);
    view = removeNode(view, `root.${id}`);
  }
  for (const field of mapping.fields.filter(
    (entry) => !existing.has(fieldKey(entry)),
  )) {
    for (const [nodeAddress, binding] of Object.entries(input.bindings)) {
      if (
        binding.type !== field.type ||
        !getNode(view, nodeAddress) ||
        !getNode(state, binding.address)
      )
        continue;
      const slot = {
        ...field,
        nodeAddress,
        address: `${binding.address}.${field.field}`,
      };
      slots.push(slot);
      const inline = getNode(state, slot.address);
      if (inline === undefined && !field.createEmpty) continue;
      const id = resourceId(slot);
      if (getNode(view, `root.${id}`))
        throw new Error(`Resource node already exists: ${id}`);
      state = applyStateEdits(state, [
        {
          op: "set",
          address: `root.${registry}`,
          value: {
            ...state[registry],
            [id]: {
              type: resourceType(field),
              name: `${field.field}: ${nodeAddress.split(".").at(-1)}`,
              ...(inline !== undefined
                ? { value: structuredClone(inline) }
                : {}),
            },
          },
        },
        { op: "set", address: slot.address, value: id },
      ]);
      view = {
        ...view,
        [registry]: view[registry] ?? { $label: "Reusable Configuration" },
        [id]: {
          $parent: `root.${registry}`,
          $view: "icon-label",
          $icon: "PiSlidersHorizontal",
          $bgColor: "teal.700",
          $label: { $state: `root.${registry}.${id}.name` },
          $connections: [
            {
              id: `mapped:${id}`,
              target: nodeAddress,
              sourceProperty: "output:resource",
              targetProperty: `config:${field.field}`,
              style: "dashed",
            },
          ],
        },
      };
    }
  }
  if (!mapping.fields.length) {
    state = { ...state };
    delete state[registry];
    view = removeNode(view, `root.${registry}`);
  }
  return {
    mapping,
    state,
    view,
    slots,
    ...(previous?.templateGraph
      ? { templateGraph: previous.templateGraph }
      : {}),
  };
}

export function resourceFormContext(
  document: MappedConfiguration,
  source: FormSchema,
  baseBindings: Record<string, StateFormBinding>,
) {
  const schema = structuredClone(source);
  const bindings: Record<string, StateFormBinding & { schemaType?: string }> = {
    ...baseBindings,
  };
  for (const field of document.mapping.fields) {
    const type = source[field.type]?.properties[field.field];
    if (!type)
      throw new Error(
        `Mapped field is missing from the interface: ${field.type}.${field.field}`,
      );
    const name = resourceType(field);
    schema[name] = {
      kind: "object",
      properties: {
        name: { type: { kind: "string" }, optional: false },
        value: structuredClone(type),
      },
      ports: { resource: { kind: "output" } },
    };
    schema[field.type].properties[field.field] = {
      ...type,
      type: { kind: "string" },
    };
    schema[field.type].ports = {
      ...schema[field.type].ports,
      [field.field]: { kind: "config", resourceType: name, multiple: false },
    };
    for (const [address, binding] of Object.entries(baseBindings)) {
      if (binding.type !== field.type) continue;
      bindings[address] = {
        ...bindings[address],
        fields: {
          ...bindings[address].fields,
          [field.field]: {
            $label: binding.fields?.[field.field]?.$label,
            $control: "select",
            $options: { $source: "callback", $dependsOn: [`root.${registry}`] },
          },
        },
      };
    }
    for (const [id, resource] of Object.entries(
      document.state[registry] ?? {},
    ) as [string, { type: string }][]) {
      if (resource.type !== name || !getNode(document.view, `root.${id}`))
        continue;
      bindings[`root.${id}`] = {
        address: `root.${registry}.${id}`,
        type: name,
        schemaType: field.type,
        fields: {
          value: {
            $label: field.field,
            ...(type.type.kind === "string"
              ? { $control: "textarea" as const }
              : {}),
          },
        },
      };
    }
  }
  return { schema, bindings };
}

export function projectResourceView(
  document: MappedConfiguration,
  preserveNodeViews = false,
): SqueedJson {
  let view = document.view;
  for (const [id, resource] of Object.entries(
    document.state[registry] ?? {},
  ) as [string, { value: unknown }][]) {
    const node = getNode(view, `root.${id}`);
    if (!node) continue;
    const structured =
      resource.value !== null &&
      typeof resource.value === "object" &&
      !Array.isArray(resource.value);
    const metadata = Object.fromEntries(
      Object.entries(node).filter(([key]) => key.startsWith("$")),
    );
    const rows = structured
      ? Object.fromEntries(
          Object.entries(resource.value as Record<string, unknown>).map(
            ([key, value]) => [
              key,
              value !== null && typeof value === "object"
                ? JSON.stringify(value)
                : value === null
                  ? "null"
                  : value,
            ],
          ),
        )
      : {};
    view = {
      ...view,
      [id]: {
        ...metadata,
        ...rows,
        $view:
          preserveNodeViews && node.$view
            ? node.$view
            : structured
              ? "object"
              : "icon-label",
      },
    };
  }
  return view;
}

export function changeMappedState(
  document: MappedConfiguration,
  state: SqueedJson,
  address?: string,
): MappedConfiguration {
  const slot = document.slots.find(
    (candidate) => candidate.address === address,
  );
  if (
    !slot ||
    getNode(document.state, slot.address) === getNode(state, slot.address)
  )
    return { ...document, state };
  const reference = getNode(state, slot.address);
  if (
    reference !== undefined &&
    (!state[registry]?.[reference] ||
      state[registry][reference].type !== resourceType(slot))
  )
    throw new Error(`Invalid resource reference at ${slot.address}.`);
  let view = document.view;
  for (const [id, resource] of Object.entries(state[registry] ?? {}) as [
    string,
    { type: string },
  ][]) {
    if (resource.type !== resourceType(slot)) continue;
    const node = getNode(view, `root.${id}`);
    if (!node) continue;
    const previous = node.$connections ?? [];
    const matches = (connection: { target: string; targetProperty?: string }) =>
      connection.target === slot.nodeAddress &&
      connection.targetProperty === `config:${slot.field}`;
    const connections = previous.filter((connection) => !matches(connection));
    if (id === reference)
      connections.push(
        previous.find(matches) ?? {
          id: `mapped:${id}:${slot.nodeAddress}`,
          target: slot.nodeAddress,
          sourceProperty: "output:resource",
          targetProperty: `config:${slot.field}`,
          style: "dashed",
        },
      );
    if (JSON.stringify(previous) !== JSON.stringify(connections))
      view = setNodeProp(view, `root.${id}`, "$connections", connections);
  }
  return { ...document, state, view };
}
