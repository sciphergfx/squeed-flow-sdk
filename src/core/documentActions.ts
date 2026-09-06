import type { SqueedJson } from "./squeedEdits";
import type { SqueedChange } from "./squeedBinding";
import type { StateForms } from "../utils/formState";

export interface FlowDocumentActionOptions {
  json?: SqueedJson;
  state?: SqueedJson;
  readOnly?: boolean;
  onJsonChange?: (json: SqueedJson, change: SqueedChange) => void;
  onStateChange?: StateForms["onChange"];
}

export function parseFlowDocument(source: string): SqueedJson {
  return validateDocument(JSON.parse(source));
}

function validateDocument(value: unknown): SqueedJson {
  if (!value || typeof value !== "object") throw new Error("Expected a JSON object or array.");
  const parents = new Set<object>();
  const visit = (entry: unknown) => {
    if (entry === null || typeof entry === "string" || typeof entry === "boolean") return;
    if (typeof entry === "number" && Number.isFinite(entry)) return;
    if (!entry || typeof entry !== "object" || parents.has(entry) ||
      (!Array.isArray(entry) && ![Object.prototype, null].includes(Object.getPrototypeOf(entry))))
      throw new Error("Document must contain only finite, acyclic JSON values.");
    parents.add(entry);
    for (const [key, child] of Object.entries(entry)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error(`Unsafe document key: ${key}`);
      visit(child);
    }
    parents.delete(entry);
  };
  visit(value);
  return structuredClone(value) as SqueedJson;
}

export function createFlowDocumentActions(options: FlowDocumentActionOptions) {
  return {
    replaceJson(value: unknown) {
      if (options.readOnly || !options.onJsonChange) throw new Error("JSON document is read-only.");
      const next = validateDocument(value);
      options.onJsonChange(next, { type: "documentReplace", address: "root" });
      return next;
    },
    replaceState(value: unknown) {
      if (options.readOnly || !options.onStateChange) throw new Error("Form state is read-only.");
      const next = validateDocument(value);
      options.onStateChange(next, { address: "root", nodeAddress: "root", previousValue: options.state, value: next, data: next });
      return next;
    },
  };
}