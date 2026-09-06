import type {
  FormChange,
  FormEdit,
  FormOptionsRequest,
} from "../../src/core/forms";
import {
  getNode,
  setNodeProp,
  type SqueedJson,
} from "../../src/core/squeedEdits";
import bindings from "./bindings.json";
import type { FlowDiagramEdge, FlowDirection } from "../../src/types";
import { applyStateEdits } from "../../src/utils/formState";

const resourceFields = [
  {
    field: "model",
    collection: "models",
    label: "Model",
    targets: { "example-model": "root.model" },
  },
  {
    field: "memory",
    collection: "memorySources",
    label: "Memory",
    targets: {
      knowledge_entry: "root.knowledgeMemory",
      support_qa: "root.supportMemory",
    },
  },
  {
    field: "tools",
    collection: "tools",
    label: "Tool",
    targets: {
      directory_lookup: "root.directoryTool",
      issue_lookup: "root.issueTool",
    },
  },
  {
    field: "promptId",
    collection: "texts",
    label: "Prompt",
    targets: {
      user_review: "root.prompt",
      directory_guidance: "root.instructions",
    },
  },
  {
    field: "instructionIds",
    collection: "texts",
    label: "Instructions",
    targets: {
      user_review: "root.prompt",
      directory_guidance: "root.instructions",
    },
  },
] as const;

export function projectWorkflowStateView(
  view: SqueedJson,
  state: SqueedJson,
  direction: FlowDirection | "C" = "LR",
): SqueedJson {
  const [sourceSide, targetSide] =
    direction === "RL"
      ? ["left", "right"]
      : direction === "TB"
        ? ["bottom", "top"]
        : direction === "BT"
          ? ["top", "bottom"]
          : ["right", "left"];
  let next = view;
  const trigger = getNode(state, "root.trigger");
  if (getNode(view, "root.trigger") && trigger) {
    const field =
      trigger.type === "event" && trigger.event
        ? "event"
        : trigger.type === "schedule" && trigger.cron
          ? "cron"
          : "type";
    const reference = { $state: `root.trigger.${field}` };
    if (
      JSON.stringify(getNode(view, "root.trigger").$subtitle) !==
      JSON.stringify(reference)
    )
      next = setNodeProp(next, "root.trigger", "$subtitle", reference);
  }
  for (const [nodeAddress, binding] of Object.entries(bindings)) {
    if (!binding.address.startsWith("root.steps.")) continue;
    const config = getNode(state, binding.address);
    const node = getNode(view, nodeAddress);
    if (!node || !config) continue;
    const existing = Array.isArray(node.$connections) ? node.$connections : [];
    const connections = existing.filter(
      (connection: { id?: string; sourceProperty?: string }) =>
        !connection.id?.startsWith("resource:") &&
        !connection.sourceProperty?.startsWith("resource:"),
    );
    const ports: {
      id: string;
      role: string;
      side: string;
      position: number;
    }[] = [];
    for (const resource of resourceFields) {
      const value = config[resource.field];
      const ids = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? [value]
          : [];
      const targets: Record<string, string> = resource.targets;
      const available =
        value !== undefined ||
        ("fields" in binding &&
          Object.prototype.hasOwnProperty.call(binding.fields, resource.field));
      if (!available) continue;
      for (const [id, target] of Object.entries(targets)) {
        if (
          !getNode(state, `root.${resource.collection}.${id}`) ||
          !getNode(view, target)
        )
          continue;
        const portId = `resource:${resource.field}:${id}`;
        ports.push({
          id: portId,
          role: "source",
          side: sourceSide,
          position: 0.5,
        });
        next = setNodeProp(next, target, "$ports", [
          { id: "resource:input", role: "target", side: targetSide },
        ]);
        if (!ids.includes(id)) continue;
        const saved = existing.find(
          (connection: { id?: string }) => connection.id === portId,
        );
        connections.push({
          ...(saved ?? { label: resource.label, style: "dashed" }),
          id: portId,
          target: targets[id],
          sourceProperty: portId,
          targetProperty: "resource:input",
        });
      }
    }
    if (JSON.stringify(existing) !== JSON.stringify(connections))
      next = setNodeProp(next, nodeAddress, "$connections", connections);
    const existingPorts = Array.isArray(node.$ports) ? node.$ports : [];
    const nextPorts = [
      ...existingPorts.filter(
        (port: { id: string }) => !port.id.startsWith("resource:"),
      ),
      ...ports.map((port, index) => ({
        ...port,
        position: (index + 1) / (ports.length + 1),
      })),
    ];
    if (JSON.stringify(existingPorts) !== JSON.stringify(nextPorts))
      next = setNodeProp(next, nodeAddress, "$ports", nextPorts);
  }
  return next;
}

export function attachWorkflowResourceReference(
  state: SqueedJson,
  edge: Pick<
    FlowDiagramEdge["data"],
    "source" | "target" | "sourceProperty" | "targetProperty"
  >,
): SqueedJson {
  if (edge.targetProperty !== "resource:input") return state;
  const binding = Object.entries(bindings).find(
    ([address]) => address === edge.source,
  )?.[1];
  if (!binding?.address.startsWith("root.steps.")) return state;
  for (const resource of resourceFields) {
    const reference = Object.entries(resource.targets).find(
      ([id, target]) =>
        edge.sourceProperty === `resource:${resource.field}:${id}` &&
        edge.target === target,
    );
    if (!reference) continue;
    const [id] = reference;
    if (!getNode(state, `root.${resource.collection}.${id}`)) return state;
    const address = `${binding.address}.${resource.field}`;
    const value = getNode(state, address);
    if (
      value === undefined &&
      !(
        "fields" in binding &&
        Object.prototype.hasOwnProperty.call(binding.fields, resource.field)
      )
    )
      return state;
    if (["tools", "memory", "instructionIds"].includes(resource.field)) {
      if (value !== undefined && !Array.isArray(value)) return state;
      const values = value ?? [];
      if (values.includes(id)) return state;
      return applyStateEdits(state, [
        { op: "set", address, value: [...values, id] },
      ]);
    }
    if (value === id) return state;
    return applyStateEdits(state, [{ op: "set", address, value: id }]);
  }
  return state;
}

export function removeWorkflowResourceReference(
  state: SqueedJson,
  edge: Pick<FlowDiagramEdge["data"], "source" | "target" | "sourceProperty">,
): SqueedJson {
  const binding = Object.entries(bindings).find(
    ([address]) => address === edge.source,
  )?.[1];
  if (!binding?.address.startsWith("root.steps.")) return state;
  for (const resource of resourceFields) {
    const reference = Object.entries(resource.targets).find(
      ([id, target]) =>
        edge.sourceProperty === `resource:${resource.field}:${id}` &&
        edge.target === target,
    );
    if (!reference) continue;
    const [id] = reference;
    const address = `${binding.address}.${resource.field}`;
    const value = getNode(state, address);
    if (Array.isArray(value) && value.includes(id))
      return applyStateEdits(state, [
        { op: "set", address, value: value.filter((entry) => entry !== id) },
      ]);
    if (value === id)
      return applyStateEdits(state, [{ op: "remove", address }]);
  }
  return state;
}

export function resolveExampleOptions(request: FormOptionsRequest) {
  const resource = resourceFields.find((entry) =>
    request.address.endsWith(`.${entry.field}`),
  );
  if (resource)
    return Object.entries(
      getNode(request.data, `root.${resource.collection}`) ?? {},
    ).map(([id, value]) => ({
      label: (value as { name: string }).name,
      value: id,
    }));
  return [];
}

export function onExampleFormChange(change: FormChange): FormEdit[] {
  if (change.address !== "root.trigger.type") return [];
  return ["event", "cron"]
    .filter(
      (key) =>
        key !==
        (change.value === "event"
          ? "event"
          : change.value === "schedule"
            ? "cron"
            : ""),
    )
    .map((key) => ({ op: "remove", address: `root.trigger.${key}` }));
}
