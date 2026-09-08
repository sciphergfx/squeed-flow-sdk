import { formOptions, formValueError, type FormSchema } from "../core/forms";
import { getNode, type SqueedJson } from "../core/squeedEdits";
import type { ContractType } from "../core/workflowContract";
import type { FlowDiagramEdge, FlowDiagramNode } from "../types";
import { applyStateEdits, type StateFormBinding } from "./formState";

export type ObjectType = Extract<ContractType, { kind: "object" }>;
export type ArrayType = Extract<ContractType, { kind: "array" }>;
export interface StructuredSlot {
  address: string;
  owner: string;
  field: string;
  type: ContractType;
  label: string;
  nodeId: string;
  present: boolean;
}
export interface StructuredNode {
  address: string;
  type: ContractType;
  declared: ContractType;
  scalar: boolean;
}
export interface StructuredForms {
  sourceSchema: FormSchema;
  sourceBindings: Record<string, StateFormBinding>;
  nodes: FlowDiagramNode[];
  edges: FlowDiagramEdge[];
  schema: FormSchema;
  bindings: Record<string, StateFormBinding>;
  slots: Map<string, StructuredSlot>;
  containers: Map<string, StructuredNode>;
}

const safeKey = (key: string) =>
  !!key &&
  !key.includes(".") &&
  !key.startsWith("$") &&
  !["__proto__", "constructor", "prototype"].includes(key);
const nodeIdFor = (address: string) =>
  `root.__form_${encodeURIComponent(address).replace(/\./g, "%2E")}`;
export const slotKey = (owner: string, field: string) =>
  JSON.stringify([owner, field]);

export function valueType(type: ContractType, value: unknown): ContractType {
  if (type.kind === "union") {
    const match = type.types.find(
      (candidate) =>
        candidate.kind ===
          (Array.isArray(value)
            ? "array"
            : value === null
              ? "null"
              : typeof value) ||
        (candidate.kind === "literal" && Object.is(candidate.value, value)),
    );
    return valueType(
      match ??
        type.types.find((candidate) => candidate.kind !== "null") ??
        type.types[0] ?? { kind: "json" },
      value,
    );
  }
  if (type.kind !== "json") return type;
  if (Array.isArray(value)) return { kind: "array", items: { kind: "json" } };
  if ((value !== null && typeof value === "object") || value === undefined)
    return {
      kind: "object",
      properties: {},
      additionalProperties: { kind: "json" },
    };
  return {
    kind:
      value === null
        ? "null"
        : (typeof value as "string" | "number" | "boolean"),
  };
}

export function emptyValue(type: ContractType): unknown {
  const resolved = valueType(type, undefined);
  if (resolved.kind === "object") return {};
  if (resolved.kind === "array") return [];
  if (resolved.kind === "literal") return resolved.value;
  if (resolved.kind === "number" || resolved.kind === "integer") return 0;
  if (resolved.kind === "boolean") return false;
  if (resolved.kind === "null") return null;
  return "";
}

export function structuredTypeOptions(type: ContractType): ContractType[] {
  if (type.kind === "json")
    return [
      { kind: "string" },
      { kind: "number" },
      { kind: "boolean" },
      { kind: "null" },
      {
        kind: "object",
        properties: {},
        additionalProperties: { kind: "json" },
      },
      { kind: "array", items: { kind: "json" } },
    ];
  return type.kind === "union" && !formOptions(type) ? type.types : [type];
}

export function structuredConnectionValue(
  state: SqueedJson,
  source: StructuredNode,
  target: StructuredSlot,
): unknown {
  if (source.address === target.address) return;
  const value = getNode(state, source.address);
  const matches = (type: ContractType, entry: unknown): boolean => {
    if (entry === undefined) return false;
    if (type.kind === "union")
      return type.types.some((member) => matches(member, entry));
    if (type.kind === "array")
      return (
        Array.isArray(entry) && entry.every((item) => matches(type.items, item))
      );
    if (type.kind === "object")
      return (
        !!entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        Object.entries(type.properties).every(
          ([key, property]) =>
            (property.optional && entry[key] === undefined) ||
            matches(property.type, entry[key]),
        ) &&
        Object.entries(entry).every(
          ([key, child]) =>
            Object.prototype.hasOwnProperty.call(type.properties, key) ||
            !type.additionalProperties ||
            matches(type.additionalProperties, child),
        )
      );
    if (entry === "")
      return (
        type.kind === "string" ||
        type.kind === "json" ||
        (type.kind === "literal" && type.value === "")
      );
    return !formValueError(type, entry, true);
  };
  if (!matches(target.type, value)) return;
  return structuredClone(value);
}

export function removeStructuredValue(
  state: SqueedJson,
  address: string,
): SqueedJson {
  const parts = address.split(".");
  const key = parts.pop()!;
  const parentAddress = parts.join(".");
  const parent = getNode(state, parentAddress);
  return Array.isArray(parent)
    ? applyStateEdits(state, [
        {
          op: "set",
          address: parentAddress,
          value: parent.filter((_, index) => String(index) !== key),
        },
      ])
    : applyStateEdits(state, [{ op: "remove", address }]);
}

export function projectStructuredForms(
  state: SqueedJson,
  baseBindings: Record<string, StateFormBinding>,
  baseSchema: FormSchema,
  baseNodes: FlowDiagramNode[],
): StructuredForms {
  const result: StructuredForms = {
    sourceSchema: baseSchema,
    sourceBindings: baseBindings,
    nodes: [],
    edges: [],
    schema: { ...baseSchema },
    bindings: { ...baseBindings },
    slots: new Map(),
    containers: new Map(),
  };
  const used = new Set(baseNodes.map((node) => node.data.id));
  const boundOwners = new Map(
    baseNodes.flatMap((node) => {
      const binding = baseBindings[node.data.id];
      return binding && baseSchema[binding.type]
        ? [[binding.address, node.data.id] as const]
        : [];
    }),
  );
  const visit = (
    owner: string,
    address: string,
    declared: ContractType,
    color: string | undefined,
    depth: number,
    generated = false,
  ) => {
    if (depth > 24 || result.containers.size > 512)
      throw new Error("Structured form exceeds the flow node limit.");
    const value = getNode(state, address);
    const type = valueType(declared, value);
    const scalar = type.kind !== "object" && type.kind !== "array";
    result.containers.set(owner, { address, type, declared, scalar });
    const schemaName = `__form:${owner}`;
    const fields = { ...result.bindings[owner]?.fields };
    const projected: ObjectType = {
      kind: "object",
      properties: {},
      ports: {
        ...(type.kind === "object" ? type.ports : {}),
        ...(generated
          ? {
              resource: {
                label: "output",
                ...(type.kind === "object" ? type.ports?.resource : {}),
                kind: "output" as const,
              },
            }
          : {}),
      },
    };
    const entries =
      type.kind === "object"
        ? {
            ...type.properties,
            ...Object.fromEntries(
              Object.keys(value ?? {})
                .filter(
                  (key) =>
                    !Object.prototype.hasOwnProperty.call(
                      type.properties,
                      key,
                    ) && type.additionalProperties,
                )
                .map((key) => [
                  key,
                  { type: type.additionalProperties!, optional: true },
                ]),
            ),
          }
        : type.kind === "array"
          ? Object.fromEntries(
              (Array.isArray(value) ? value : []).map((_, index) => [
                String(index),
                { type: type.items, optional: true },
              ]),
            )
          : {
              value: {
                type: formOptions(declared) ? declared : type,
                optional: false,
              },
            };
    for (const [key, property] of Object.entries(entries)) {
      if (!safeKey(key))
        throw new Error(`Unsupported structured property key: ${key}`);
      const childAddress = scalar ? address : `${address}.${key}`;
      const childValue = getNode(state, childAddress);
      const childType = valueType(property.type, childValue);
      const composite =
        childType.kind === "object" || childType.kind === "array";
      const existingPort = projected.ports?.[key];
      const selectablePort =
        existingPort?.kind === "config" &&
        (fields[key]?.$options || formOptions(property.type));
      const dynamic =
        property.type.kind === "json" ||
        (property.type.kind === "union" && !formOptions(property.type));
      if (
        fields[key]?.$control === "upload" ||
        (!composite && type.kind !== "array" && (!dynamic || scalar)) ||
        selectablePort
      ) {
        projected.properties[key] = {
          ...property,
          type: property.type.kind === "json" ? childType : property.type,
        };
        continue;
      }
      const nodeId = boundOwners.get(childAddress) ?? nodeIdFor(childAddress);
      const label = type.kind === "array" ? `Item ${Number(key) + 1}` : key;
      const slot: StructuredSlot = {
        address: childAddress,
        owner,
        field: key,
        type: property.type,
        label,
        nodeId,
        present: childValue !== undefined,
      };
      result.slots.set(slotKey(owner, key), slot);
      projected.ports![key] = {
        kind: "config",
        resourceType: `__form:${nodeId}`,
      };
      if (childValue === undefined) continue;
      result.edges.push({
        data: {
          id: `__form-edge:${owner}:${key}`,
          source: nodeId,
          target: owner,
          sourceProperty: "output:resource",
          targetProperty: `config:${key}`,
          isEdgeDashed: true,
        },
      });
      if (result.containers.has(nodeId) || boundOwners.has(childAddress))
        continue;
      if (used.has(nodeId))
        throw new Error(`Structured node identity conflict: ${nodeId}`);
      used.add(nodeId);
      const node: FlowDiagramNode = {
        data: {
          id: nodeId,
          type: "objectView",
          label,
          headerTitle: label,
          description: {},
          config: {
            form: true,
            icon:
              childType.kind === "array"
                ? "PiListNumbers"
                : composite
                  ? "PiBracketsCurly"
                  : "PiTextT",
          },
          viewProps: { bgColor: color },
        },
      };
      result.nodes.push(node);
      visit(nodeId, childAddress, property.type, color, depth + 1, true);
      const child = result.schema[`__form:${nodeId}`];
      node.data.description = Object.fromEntries(
        Object.keys(child.properties)
          .map((field) => [
            field,
            getNode(
              state,
              childType.kind === "array" || childType.kind === "object"
                ? `${childAddress}.${field}`
                : childAddress,
            ),
          ])
          .filter(([, value]) => value !== undefined),
      );
    }
    result.schema[schemaName] = projected;
    result.bindings[owner] = {
      ...result.bindings[owner],
      address,
      type: schemaName,
      fields,
    };
  };
  for (const node of baseNodes) {
    const binding = baseBindings[node.data.id];
    if (binding?.portResources) continue;
    const schema = binding && baseSchema[binding.type];
    if (!binding || !schema || getNode(state, binding.address) === undefined)
      continue;
    visit(
      node.data.id,
      binding.address,
      schema,
      node.data.viewProps?.bgColor,
      0,
      result.edges.some((edge) => edge.data.source === node.data.id),
    );
  }
  for (const edge of result.edges) {
    const binding = result.bindings[edge.data.source];
    const ports = result.schema[binding.type].ports!;
    ports.resource = {
      ...ports.resource,
      kind: "output",
      label: ports.resource?.label ?? "output",
    };
  }
  return result;
}
