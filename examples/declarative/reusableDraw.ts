import {
  getNode,
  addConnection,
  setCollapsed,
  type SqueedJson,
} from "../../src/core/squeedEdits";
import { applyStateEdits, type StateForms } from "../../src/utils/formState";
import type { FormSchema } from "../../src/core/forms";
import type { FlowNodeCreationRequest } from "../../src/types";
import type { DiagramBindings, DiagramDesign } from "./types";

export interface ReusableDrawPackage {
  version: 1;
  source: SqueedJson;
  bindings: DiagramBindings;
  design: DiagramDesign;
  schema: FormSchema;
}
export interface ReusableDrawItem {
  id: string;
  label: string;
  icon: string;
  type: string;
  kind?: string;
  address?: string;
  ports: string[];
}
const displayName = (value: string) =>
  value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const bindingPort = (
  schema: FormSchema,
  bindings: StateForms["bindings"],
  address: string,
  port: string,
) => {
  const separator = port.indexOf(":");
  const kind = port.slice(0, separator),
    field = port.slice(separator + 1);
  const binding = bindings[address];
  const declaration = binding && schema[binding.type]?.ports?.[field];
  return declaration?.kind === kind ? declaration : undefined;
};

export function reusableDrawItems(
  config: ReusableDrawPackage | undefined,
  view: SqueedJson,
  state: SqueedJson,
  schema: FormSchema,
  bindings: StateForms["bindings"],
  request?: FlowNodeCreationRequest,
): ReusableDrawItem[] {
  const endpoint = request?.sourceProperty
    ? bindingPort(
        schema,
        bindings,
        request.sourceNodeId,
        request.sourceProperty,
      )
    : undefined;
  const endpointType = request && bindings[request.sourceNodeId]?.type;
  const portsFor = (type: string) =>
    !request ? [""] : Object.entries(schema[type]?.ports ?? {})
      .filter(([, port]) => {
        if (request.reverse) {
          if (port.kind !== "output" && port.kind !== "error") return false;
          return endpoint?.kind !== "config" || endpoint.resourceType === type;
        }
        if (port.kind === "input") return endpoint?.kind !== "config";
        return port.kind === "config" && port.resourceType === endpointType;
      })
      .map(([name, port]) => `${port.kind}:${name}`);
  const items: ReusableDrawItem[] = Object.entries(
    config?.bindings.collection.types ?? {},
  ).map(([kind, type]) => ({
    id: `type:${kind}`,
    label:
      config?.bindings.collection.templates?.[kind]?.label ?? displayName(kind),
    icon:
      config?.bindings.collection.templates?.[kind]?.icon ||
      config?.design.types[kind]?.$icon ||
      config?.design.defaults.$icon ||
      "PiBracketsCurly",
    type,
    kind,
    ports: portsFor(type),
  }));
  if (!request) return items;
  for (const [address, binding] of Object.entries(bindings)) {
    if (address === request.sourceNodeId) continue;
    if (
      config &&
      binding.address.startsWith(`${config.bindings.collection.address}.`)
    )
      continue;
    const node = getNode(view, address);
    if (!node) continue;
    const record = getNode(state, binding.address);
    const label =
      typeof node.$label === "string"
        ? node.$label
        : (record?.name ?? address.split(".").at(-1));
    const ports = portsFor(binding.type);
    for (const port of Object.keys(binding.portResources ?? {}))
      if (
        request.reverse &&
        /^(output|error):/.test(port) &&
        !ports.includes(port)
      )
        ports.push(port);
    items.push({
      id: address,
      address,
      label: String(label),
      icon: node.$icon || "PiBracketsCurly",
      type: binding.type,
      ports,
    });
  }
  return items;
}

export function revealReusable(view: SqueedJson, address: string) {
  let next = view;
  let parent = getNode(view, address)?.$parent;
  const seen = new Set<string>();
  while (typeof parent === "string" && !seen.has(parent)) {
    seen.add(parent);
    next = setCollapsed(next, parent, false);
    parent = getNode(view, parent)?.$parent;
  }
  return next;
}

export function connectReusable(
  view: SqueedJson,
  request: FlowNodeCreationRequest,
  address: string,
  port: string,
) {
  if (!getNode(view, request.sourceNodeId) || !getNode(view, address))
    throw new Error("A node in the pending draw no longer exists.");
  const revealed = revealReusable(view, address);
  const source = request.reverse ? address : request.sourceNodeId;
  const connection = {
    target: request.reverse ? request.sourceNodeId : address,
    sourceProperty: request.reverse ? port : request.sourceProperty,
    targetProperty: request.reverse ? request.sourceProperty : port,
  };
  const existing = getNode(revealed, source)?.$connections;
  if (
    Array.isArray(existing) &&
    existing.some(
      (entry) =>
        entry.target === connection.target &&
        entry.sourceProperty === connection.sourceProperty &&
        entry.targetProperty === connection.targetProperty,
    )
  )
    return revealed;
  return addConnection(revealed, source, connection);
}

export function createReusableStep(
  config: ReusableDrawPackage,
  item: ReusableDrawItem,
  request: FlowNodeCreationRequest | undefined,
  port: string,
  id: string,
) {
  if (!item.kind || !Object.hasOwn(config.bindings.collection.types, item.kind))
    throw new Error("Reusable template is no longer available.");
  if (!item.ports.includes(port))
    throw new Error("Choose a compatible connection port.");
  const collection = config.bindings.collection;
  const records = getNode(config.source, collection.address);
  if (!records || typeof records !== "object")
    throw new Error("Workflow collection is unavailable.");
  if (
    Object.values(records).some(
      (record) => getNode(record, `root.${collection.idField}`) === id,
    )
  )
    throw new Error("Node ID already exists.");
  const sample = Object.values(records).find(
    (record) => getNode(record, `root.${collection.typeField}`) === item.kind,
  );
  let record: SqueedJson = {};
  const defaults =
    collection.templates?.[item.kind]?.defaults ??
    (collection.propertiesField
      ? getNode(sample ?? {}, `root.${collection.propertiesField}`)
      : undefined);
  record = applyStateEdits(record, [
    { op: "set", address: `root.${collection.idField}`, value: id },
    { op: "set", address: `root.${collection.typeField}`, value: item.kind },
    { op: "set", address: `root.${collection.labelField}`, value: item.label },
    ...(collection.propertiesField
      ? [
          {
            op: "set" as const,
            address: `root.${collection.propertiesField}`,
            value: defaults ?? {},
          },
        ]
      : []),
  ]);
  const key = `${collection.nodePrefix}${encodeURIComponent(id).replace(/\./g, "%2E")}`;
  const address = `root.${key}`;
  const nextRecords = Array.isArray(records)
    ? [...records, record]
    : { ...records, [id]: record };
  let source = applyStateEdits(config.source, [
    { op: "set", address: collection.address, value: nextRecords },
  ]);
  if (!request) return { configuration: { ...config, source }, address };
  const dependencies = config.bindings.dependencies;
  const sourceProperty = request.reverse ? port : request.sourceProperty;
  const targetProperty = request.reverse ? request.sourceProperty : port;
  const existing = Object.entries(records).find(
    ([, entry]) =>
      `root.${collection.nodePrefix}${encodeURIComponent(getNode(entry, `root.${collection.idField}`)).replace(/\./g, "%2E")}` ===
      request.sourceNodeId,
  );
  let design = config.design;
  if (
    dependencies &&
    existing &&
    sourceProperty === dependencies.sourceProperty &&
    targetProperty === dependencies.targetProperty
  ) {
    const targetIndex = request.reverse
      ? existing[0]
      : Array.isArray(records)
        ? records.length
        : id;
    const prerequisite = request.reverse
      ? id
      : getNode(existing[1], `root.${collection.idField}`);
    const path = `${collection.address}.${targetIndex}.${dependencies.field}`;
    source = applyStateEdits(source, [
      {
        op: "set",
        address: path,
        value: [...new Set([...(getNode(source, path) ?? []), prerequisite])],
      },
    ]);
  } else {
    const owner = request.reverse ? key : request.sourceNodeId.slice(5);
    if (!owner || owner.includes("."))
      throw new Error("This source requires an existing reusable node.");
    design = {
      ...design,
      nodes: {
        ...design.nodes,
        [owner]: {
          ...design.nodes[owner],
          $connections: [
            ...(design.nodes[owner]?.$connections ?? []),
            {
              id: `draw:${id}`,
              target: request.reverse ? request.sourceNodeId : address,
              sourceProperty,
              targetProperty,
            },
          ],
        },
      },
    };
  }
  return { configuration: { ...config, source, design }, address };
}
