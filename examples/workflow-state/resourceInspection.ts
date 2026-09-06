import {
  getNode,
  updateNode,
  type SqueedJson,
} from "../../src/core/squeedEdits";
import { conditionMatches, type FormSchema } from "../../src/core/forms";
import type { StateForms } from "../../src/utils/formState";
import type { MappedConfiguration } from "./resourceMapping";

export function projectResourceInspection(
  view: SqueedJson,
  document: MappedConfiguration,
  schema: FormSchema | undefined,
  bindings: StateForms["bindings"],
): SqueedJson {
  let projected = view;
  const registry = getNode(document.state, "root.sdkResources");
  const addresses = new Set(document.slots.map((slot) => slot.nodeAddress));
  for (const nodeAddress of addresses) {
    const binding = bindings[nodeAddress];
    const type = binding && schema?.[binding.type];
    const record = binding && getNode(document.state, binding.address);
    if (!type || !record || !getNode(view, nodeAddress)) continue;
    const rows: Record<string, string | number | boolean> = {};
    for (const field of Object.keys(type.properties)) {
      if (!Object.hasOwn(record, field) || field.startsWith("$")) continue;
      if (
        !conditionMatches(binding.fields?.[field]?.$visibleWhen, document.state)
      )
        continue;
      const slot = document.slots.find(
        (slot) => slot.nodeAddress === nodeAddress && slot.field === field,
      );
      const resource =
        slot && typeof record[field] === "string"
          ? registry?.[record[field]]
          : undefined;
      const value = slot ? resource?.value : record[field];
      rows[field] =
        value === undefined
          ? ""
          : value === null
            ? "null"
            : typeof value === "object"
              ? JSON.stringify(value, null, 2)
              : value;
    }
    projected = updateNode(projected, nodeAddress, (node) => ({
      ...node,
      ...rows,
    }));
  }
  return projected;
}
