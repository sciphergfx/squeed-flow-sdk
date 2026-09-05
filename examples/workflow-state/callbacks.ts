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

const resourceFields = [
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
): SqueedJson {
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
      (connection: { id?: string }) => !connection.id?.startsWith("resource:"),
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
      for (const id of new Set<string>(ids)) {
        if (
          !Object.prototype.hasOwnProperty.call(targets, id) ||
          !getNode(state, `root.${resource.collection}.${id}`)
        )
          continue;
        const portId = `resource:${resource.field}:${id}`;
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
        ports.push({
          id: portId,
          role: "source",
          side: "bottom",
          position: 0.5,
        });
        next = setNodeProp(next, targets[id], "$ports", [
          { id: "resource:input", role: "target", side: "top" },
        ]);
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

export function resolveExampleOptions(request: FormOptionsRequest) {
  if (request.address.endsWith(".model"))
    return [{ label: "Example Model", value: "example-model" }];
  if (request.address.endsWith(".memory"))
    return [
      { label: "Knowledge Entries", value: "knowledge_entry" },
      { label: "Support Answers", value: "support_qa" },
    ];
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
