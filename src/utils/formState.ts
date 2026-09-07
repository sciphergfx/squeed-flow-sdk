import {
  applyFormChange,
  type FormChange,
  type FormEdit,
  type FormFieldConfig,
  type FormSchema,
} from "../core/forms";
import { getNode, type SqueedJson } from "../core/squeedEdits";

export interface StateFormBinding {
  address: string;
  type: string;
  schemaType?: string;
  portResources?: Record<string, string>;
  resourceType?: string;
  fields?: Record<string, FormFieldConfig>;
}

export interface StateForms {
  structured?: boolean;
  references?: import("./runtimeBindings").RuntimeReference[];
  /** Controlled resource data. Replace immutably to update forms, summaries and view references. */
  state: SqueedJson;
  bindings: Record<string, StateFormBinding>;
  renderForm?: (nodeAddress: string) => import("react").ReactNode | undefined;
  /** Receives user form edits after dependent edits. External state replacements do not echo here. */
  onStateChange?: (state: SqueedJson, change: FormChange) => void;
  /** Compatibility alias; onStateChange takes precedence when both are supplied. */
  onChange?: (state: SqueedJson, change: FormChange) => void;
}

export function applyStateEdits(
  state: SqueedJson,
  edits: readonly FormEdit[],
): SqueedJson {
  let next = state;
  for (const edit of edits) {
    if (edit.op !== "set" && edit.op !== "remove")
      throw new Error("Unsupported state edit.");
    const parts = edit.address.split(".");
    if (
      parts.some(
        (part) =>
          part.startsWith("$") ||
          ["__proto__", "prototype", "constructor"].includes(part),
      )
    )
      throw new Error(
        "State edits cannot target view metadata or unsafe keys.",
      );
    const value = edit.op === "remove" ? undefined : edit.value;
    assertPlainState(value);
    next = applyFormChange(next, {
      address: edit.address,
      nodeAddress: parts.slice(0, -1).join("."),
      value,
    });
  }
  assertPlainState(next);
  return next;
}

export function resolveStateForm(
  bindings: StateForms["bindings"],
  nodeAddress: string,
  schema?: FormSchema,
) {
  const binding = Object.prototype.hasOwnProperty.call(bindings, nodeAddress)
    ? bindings[nodeAddress]
    : undefined;
  if (
    !binding ||
    !schema ||
    !Object.prototype.hasOwnProperty.call(schema, binding.type)
  )
    return;
  return {
    address: binding.address,
    type: schema[binding.type],
    fields: binding.fields ?? {},
  };
}

function assertPlainState(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (
      key.startsWith("$") ||
      ["__proto__", "prototype", "constructor"].includes(key)
    )
      throw new Error(
        `Form state cannot contain view metadata or unsafe keys: ${key}`,
      );
    assertPlainState(child);
  }
}

export function changeFormState(
  state: SqueedJson,
  change: FormChange,
  handler?: (change: FormChange) => FormEdit[] | void,
) {
  assertPlainState(change.value);
  const next = applyFormChange(state, change, handler);
  assertPlainState(next);
  return next;
}

export function resolveStateView(
  view: SqueedJson,
  state: SqueedJson,
): SqueedJson {
  const visit = (value: any, key = ""): any => {
    if (!value || typeof value !== "object") return value;
    if (
      [
        "$label",
        "$subtitle",
        "$content",
        "$icon",
        "$bgColor",
        "$textColor",
        "$borderColor",
      ].includes(key) &&
      typeof value.$state === "string"
    ) {
      const resolved = getNode(state, value.$state);
      return resolved === undefined || resolved === null
        ? ""
        : typeof resolved === "object"
          ? JSON.stringify(resolved, null, 2)
          : String(resolved);
    }
    let next = value;
    for (const [childKey, child] of Object.entries(value)) {
      const resolved = visit(child, childKey);
      if (resolved !== child) {
        if (next === value)
          next = Array.isArray(value) ? [...value] : { ...value };
        Object.defineProperty(next, childKey, {
          value: resolved,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
    return next;
  };
  return visit(view);
}
