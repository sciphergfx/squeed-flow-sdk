import type { FormSchema } from "../../src/core/forms";
import {
  getNode,
  setNodeProp,
  type SqueedJson,
} from "../../src/core/squeedEdits";
import type { ContractPort } from "../../src/core/workflowContract";
import type { FlowDirection, SqueedConnection } from "../../src/types";
import {
  applyStateEdits,
  type StateFormBinding,
} from "../../src/utils/formState";
import bindings from "./bindings.json";

export const workflowNodeBindings: Record<string, StateFormBinding> = {
  ...bindings,
  "root.prompt": { address: "root.texts.user_review", type: "TextConfig" },
  "root.instructions": {
    address: "root.texts.directory_guidance",
    type: "TextConfig",
  },
};

export function projectWorkflowView(
  view: SqueedJson,
  state: SqueedJson,
  schema: FormSchema | undefined,
  direction: FlowDirection | "C",
  nodeBindings = workflowNodeBindings,
) {
  let next = projectWorkflowPorts(view, schema, direction, nodeBindings);
  for (const [address, binding] of Object.entries(nodeBindings)) {
    if (!binding.portResources || !getNode(view, address)) continue;
    for (const [port, resourceAddress] of Object.entries(
      binding.portResources,
    )) {
      const value = getNode(state, resourceAddress);
      const field = port.slice(port.indexOf(":") + 1);
      const label = value?.name ?? field;
      if (getNode(next, address)[field] !== label)
        next = setNodeProp(next, address, field, label);
    }
  }
  const trigger = getNode(state, "root.trigger");
  if (trigger && getNode(view, "root.trigger")) {
    const field =
      trigger.type === "event" && trigger.event
        ? "event"
        : trigger.type === "schedule" && trigger.cron
          ? "cron"
          : "type";
    const subtitle = { $state: `root.trigger.${field}` };
    if (
      JSON.stringify(getNode(view, "root.trigger").$subtitle) !==
      JSON.stringify(subtitle)
    )
      next = setNodeProp(next, "root.trigger", "$subtitle", subtitle);
  }
  return next;
}

function declaredPorts(
  schema: FormSchema | undefined,
  address: string,
  nodeBindings = workflowNodeBindings,
) {
  const binding = nodeBindings[address];
  const ports = { ...(binding ? schema?.[binding.type]?.ports : {}) };
  for (const id of Object.keys(binding?.portResources ?? {})) {
    const separator = id.indexOf(":");
    const kind = id.slice(0, separator);
    const name = id.slice(separator + 1);
    if (separator > 0 && name && (kind === "output" || kind === "error")) ports[name] = { kind };
  }
  return ports;
}

export function projectWorkflowPorts(
  view: SqueedJson,
  schema: FormSchema | undefined,
  direction: FlowDirection | "C",
  nodeBindings = workflowNodeBindings,
) {
  const sides =
    direction === "RL"
      ? { input: "right", output: "left", config: "bottom", error: "top" }
      : direction === "TB"
        ? { input: "top", output: "bottom", config: "right", error: "left" }
        : direction === "BT"
          ? { input: "bottom", output: "top", config: "left", error: "right" }
          : { input: "left", output: "right", config: "top", error: "bottom" };
  let next = view;
  for (const [address] of Object.entries(nodeBindings)) {
    const node = getNode(view, address);
    if (!node) continue;
    const rowResources =
      direction !== "TB" && direction !== "BT"
        ? nodeBindings[address].portResources
        : undefined;
    const declarations = Object.entries(
      declaredPorts(schema, address, nodeBindings),
    ).filter(([name, port]) => !rowResources?.[`${port.kind}:${name}`]);
    const ports = declarations.map(([name, port]) => ({
      id: `${port.kind}:${name}`,
      role:
        port.kind === "input" || port.kind === "config" ? "target" : "source",
      side: sides[port.kind],
      position: 0.5,
      ...(port.kind === "config" ? { placement: "config" as const } : {}),
    }));
    for (const port of ports) {
      const siblings = ports.filter(
        (candidate) => candidate.side === port.side,
      );
      port.position = (siblings.indexOf(port) + 1) / (siblings.length + 1);
    }
    const customPorts = (Array.isArray(node.$ports) ? node.$ports : []).filter(
      (port: { id: string }) =>
        !/^(resource|input|config|output|error):/.test(port.id),
    );
    const combined = [...customPorts.map((port) => ({ ...port })), ...ports];
    for (const side of new Set(
      combined
        .filter((port) => port.id.startsWith("template:"))
        .map((port) => port.side),
    )) {
      const siblings = combined.filter((port) => port.side === side);
      siblings.forEach((port, index) => {
        port.position = (index + 1) / (siblings.length + 1);
      });
    }
    if (JSON.stringify(node.$ports ?? []) !== JSON.stringify(combined))
      next = setNodeProp(next, address, "$ports", combined);
  }
  return next;
}

function portAt(
  schema: FormSchema,
  address: string,
  id: string | undefined,
  nodeBindings = workflowNodeBindings,
): [string, ContractPort] | undefined {
  return Object.entries(declaredPorts(schema, address, nodeBindings)).find(
    ([name, port]) => id === `${port.kind}:${name}`,
  );
}

function resourceAddressFor(
  binding: StateFormBinding,
  sourceProperty?: string,
) {
  return binding.portResources
    ? binding.portResources[sourceProperty ?? ""]
    : binding.address;
}

export function reconcileWorkflowConnections(
  view: SqueedJson,
  state: SqueedJson,
  schema?: FormSchema,
  previousView?: SqueedJson,
  nodeBindings = workflowNodeBindings,
) {
  if (!schema) return { view, state };
  const identity = (source: string, connection: SqueedConnection) =>
    JSON.stringify([
      source,
      connection.target,
      connection.sourceProperty,
      connection.targetProperty,
    ]);
  const previousConnections = Object.keys(nodeBindings).flatMap((source) => {
    const node = previousView && getNode(previousView, source);
    return (
      (Array.isArray(node?.$connections)
        ? node.$connections
        : []) as SqueedConnection[]
    ).map((connection) => ({ source, connection }));
  });
  const saved = new Set(
    previousConnections.map((record) =>
      identity(record.source, record.connection),
    ),
  );
  const records: {
    source: string;
    connection: SqueedConnection;
    field?: string;
    resourceId?: string;
    multiple?: boolean;
  }[] = [];
  for (const source of Object.keys(nodeBindings)) {
    const node = getNode(view, source);
    for (const connection of (Array.isArray(node?.$connections)
      ? node.$connections
      : []) as SqueedConnection[]) {
      if (!getNode(view, connection.target)) continue;
      if (
        connection.sourceProperty === undefined &&
        connection.targetProperty === undefined
      ) {
        records.push({ source, connection });
        continue;
      }
      const output = portAt(
        schema,
        source,
        connection.sourceProperty,
        nodeBindings,
      );
      const input = portAt(
        schema,
        connection.target,
        connection.targetProperty,
        nodeBindings,
      );
      if (
        !output ||
        !input ||
        !["output", "error"].includes(output[1].kind) ||
        !["input", "config"].includes(input[1].kind)
      ) {
        if (saved.has(identity(source, connection)))
          records.push({ source, connection });
        continue;
      }
      if (input[1].kind === "config") {
        const resource = nodeBindings[source];
        const resourceAddress = resourceAddressFor(
          resource,
          connection.sourceProperty,
        );
        if (
          (resource.resourceType ?? resource.type) !== input[1].resourceType ||
          !resourceAddress ||
          !getNode(state, resourceAddress)
        ) {
          if (saved.has(identity(source, connection)))
            records.push({ source, connection });
          continue;
        }
        records.push({
          source,
          connection,
          field: input[0],
          resourceId: resourceAddress.split(".").at(-1),
          multiple: input[1].multiple,
        });
      } else records.push({ source, connection });
    }
  }
  const scalarLast = new Map<string, (typeof records)[number]>();
  if (previousView)
    records.sort(
      (first, second) =>
        Number(saved.has(identity(second.source, second.connection))) -
        Number(saved.has(identity(first.source, first.connection))),
    );
  for (const record of records)
    if (record.field && !record.multiple)
      scalarLast.set(`${record.connection.target}:${record.field}`, record);
  const seen = new Set<string>();
  const accepted = records.filter((record) => {
    if (
      record.field &&
      !record.multiple &&
      scalarLast.get(`${record.connection.target}:${record.field}`) !== record
    )
      return false;
    const key = identity(record.source, record.connection);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let nextView = view;
  let nextState = state;
  for (const [address, binding] of Object.entries(nodeBindings)) {
    const node = getNode(view, address);
    if (!node) continue;
    const connections = accepted
      .filter((record) => record.source === address)
      .map((record) => record.connection);
    if (JSON.stringify(node.$connections ?? []) !== JSON.stringify(connections))
      nextView = setNodeProp(nextView, address, "$connections", connections);
    for (const [field, port] of Object.entries(
      declaredPorts(schema, address, nodeBindings),
    )) {
      if (port.kind !== "config") continue;
      const refs = [
        ...new Set(
          accepted
            .filter(
              (record) =>
                record.connection.target === address && record.field === field,
            )
            .map((record) => record.resourceId!),
        ),
      ];
      if (previousView) {
        const previousRefs = [
          ...new Set(
            previousConnections
              .filter(
                (record) =>
                  record.connection.target === address &&
                  record.connection.targetProperty === `config:${field}` &&
                  (nodeBindings[record.source]?.resourceType ??
                    nodeBindings[record.source]?.type) === port.resourceType,
              )
              .map((record) =>
                resourceAddressFor(
                  nodeBindings[record.source],
                  record.connection.sourceProperty,
                )
                  ?.split(".")
                  .at(-1),
              )
              .filter((id): id is string => !!id),
          ),
        ];
        if (
          JSON.stringify([...previousRefs].sort()) ===
          JSON.stringify([...refs].sort())
        )
          continue;
      }
      const value = port.multiple ? refs : refs[0];
      const fieldAddress = `${binding.address}.${field}`;
      if (
        JSON.stringify(getNode(nextState, fieldAddress)) ===
        JSON.stringify(value)
      )
        continue;
      nextState = applyStateEdits(nextState, [
        value === undefined
          ? { op: "remove", address: fieldAddress }
          : { op: "set", address: fieldAddress, value },
      ]);
    }
  }
  return { view: nextView, state: nextState };
}

export function workflowResourceOptions(
  schema: FormSchema | undefined,
  nodeAddress: string,
  address: string,
  state: SqueedJson,
  nodeBindings = workflowNodeBindings,
) {
  const binding = nodeBindings[nodeAddress];
  if (!binding) return [];
  const field = address.slice(binding.address.length + 1);
  const port = declaredPorts(schema, nodeAddress, nodeBindings)[field];
  if (port?.kind !== "config") return [];
  return Object.values(nodeBindings).flatMap((resource) => {
    if ((resource.resourceType ?? resource.type) !== port.resourceType)
      return [];
    const addresses = resource.portResources
      ? Object.values(resource.portResources)
      : [resource.address];
    return addresses.flatMap((address) => {
      const value = getNode(state, address);
      return value
        ? [
            {
              label: String(value.name ?? address.split(".").at(-1)),
              value: address.split(".").at(-1)!,
            },
          ]
        : [];
    });
  });
}
