import { getNode, setNodeProp, updateNode, type SqueedJson } from "./squeedEdits";
import { parseJsonContract, parseTypeScriptForm, type ContractType } from "./workflowContract";

export type FormSchema = Record<string, Extract<ContractType, { kind: "object" }>>;
export type FormValue = string | number | boolean | null;
export interface FormOption { label: string; value: FormValue }
export interface FormCondition { $address: string; $equals: FormValue }
export interface FormFieldConfig {
  $label?: string;
  $control?: "input" | "textarea" | "select" | "pills" | "checkbox";
  $visibleWhen?: FormCondition;
  $requiredWhen?: FormCondition;
  $options?: { $source: "callback"; $dependsOn?: string[] };
}
export interface FormBinding { $type: string; $fields?: Record<string, FormFieldConfig> }
export interface FormRequest {
  address: string;
  nodeAddress: string;
  nodeId?: string;
  data: SqueedJson;
}
export interface FormChange extends FormRequest { previousValue: unknown; value: unknown }
export type FormEdit = { op: "set"; address: string; value: unknown } | { op: "remove"; address: string };
export interface FormOptionsRequest extends FormRequest { signal: AbortSignal }

const readViews = new WeakMap<object, object>();
export function readOnlyFormData<Value>(value: Value): Value {
  if (!value || typeof value !== "object") return value;
  const cached = readViews.get(value);
  if (cached) return cached as Value;
  const deny = () => { throw new Error("Form callback data is read-only. Return edits instead."); };
  const view = new Proxy(Array.isArray(value) ? [] : {}, {
    get: (_, key) => readOnlyFormData(Reflect.get(value, key)),
    has: (_, key) => Reflect.has(value, key),
    ownKeys: () => Reflect.ownKeys(value),
    getOwnPropertyDescriptor: (_, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      return descriptor && { ...descriptor, value: readOnlyFormData(Reflect.get(value, key)), configurable: key !== "length" || !Array.isArray(value) };
    },
    set: deny, deleteProperty: deny, defineProperty: deny, setPrototypeOf: deny, preventExtensions: deny,
  });
  readViews.set(value, view);
  return view as Value;
}

export function resolveFormNode(data: SqueedJson, address: string, schemas: FormSchema) {
  const parts = address.split(".");
  for (let length = parts.length; length > 0; length--) {
    const ancestor = parts.slice(0, length).join(".");
    const binding = getNode(data, ancestor)?.$form as FormBinding | undefined;
    if (!binding?.$type) continue;
    let type: ContractType | undefined = Object.prototype.hasOwnProperty.call(schemas, binding.$type) ? schemas[binding.$type] : undefined;
    for (const part of parts.slice(length)) {
      if (type?.kind === "array" && /^\d+$/.test(part)) type = type.items;
      else if (type?.kind === "object") type = Object.prototype.hasOwnProperty.call(type.properties, part) ? type.properties[part].type : undefined;
      else type = undefined;
    }
    if (type?.kind !== "object") return undefined;
    const prefix = parts.slice(length).join(".");
    const fields = Object.fromEntries(Object.entries(binding.$fields ?? {}).filter(([key]) => !prefix || key.startsWith(`${prefix}.`)).map(([key, value]) => [prefix ? key.slice(prefix.length + 1) : key, value]));
    return { type, fields, binding };
  }
}

export async function readFormSchema(file: Pick<File, "name" | "size" | "text">, typeNames: string[]): Promise<FormSchema> {
  if (file.size > 256 * 1024) throw new Error("Form schema exceeds 256 KB.");
  const source = await file.text();
  if (file.name.endsWith(".ts")) {
    if (!typeNames.length || typeNames.length > 32) throw new Error("Choose between 1 and 32 form interface names.");
    const entries = [];
    for (const name of new Set(typeNames)) entries.push([name, await parseTypeScriptForm(source, file.name, name)] as const);
    return Object.fromEntries(entries);
  }
  if (!file.name.endsWith(".json")) throw new Error("Choose a .ts interface or .json schema file.");
  const contract = parseJsonContract(source, file.name);
  return Object.fromEntries(Object.entries(contract.nodes).map(([name, property]) => [name, property.type as FormSchema[string]]));
}

export function conditionMatches(condition: FormCondition | undefined, data: SqueedJson): boolean {
  return !condition || getNode(data, condition.$address) === condition.$equals;
}

export function formOptions(type: ContractType): FormOption[] | undefined {
  const types = type.kind === "array" ? type.items : type;
  const values = types.kind === "union" ? types.types : [types];
  if (!values.every(value => value.kind === "literal")) return undefined;
  return values.map(value => ({ label: String(value.value), value: value.value }));
}

export function formValueError(type: ContractType, value: unknown, required: boolean): string | undefined {
  if (value === undefined || value === "") return required ? "Required" : undefined;
  if (type.kind === "union") return type.types.some(member => !formValueError(member, value, true)) ? undefined : "Choose a valid value";
  if (type.kind === "literal") return value === type.value ? undefined : "Choose a valid value";
  if (type.kind === "array") return Array.isArray(value) && value.every(item => !formValueError(type.items, item, true)) ? undefined : "Invalid list value";
  if (type.kind === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "Expected an object";
    return Object.entries(type.properties).some(([key, property]) => formValueError(property.type, (value as Record<string, unknown>)[key], !property.optional)) ? "Invalid object fields" : undefined;
  }
  if (type.kind === "null") return value === null ? undefined : "Expected null";
  if (type.kind === "integer") return Number.isInteger(value) ? undefined : "Expected a whole number";
  if (typeof value !== type.kind || (typeof value === "number" && !Number.isFinite(value))) return `Expected ${type.kind}`;
}

function applyEdit(data: SqueedJson, edit: FormEdit): SqueedJson {
  const parts = edit.address.split(".");
  if (parts.shift() !== "root" || !parts.length || parts.some(part => !part || ["__proto__", "prototype", "constructor", "#"].includes(part)))
    throw new Error("Invalid form field address.");
  const key = parts.pop()!;
  const colorKey = key === "$bgColor" || key === "$textColor" || key === "$borderColor";
  if (parts.some(part => part.startsWith("$")) || key.startsWith("$") && !colorKey) throw new Error("Unsupported form metadata address.");
  const parentAddress = ["root", ...parts].join(".");
  const parent = getNode(data, parentAddress);
  if (!parent || typeof parent !== "object") throw new Error(`Missing form parent: ${parentAddress}`);
  if (colorKey) {
    if (edit.op === "set" && typeof edit.value !== "string") throw new Error("Node colors must be strings.");
    return setNodeProp(data, parentAddress, key, edit.op === "remove" ? undefined : edit.value);
  }
  return updateNode(data, parentAddress, current => {
    const container = Array.isArray(current.$) ? current.$ : current;
    if (edit.op === "remove" && !Object.prototype.hasOwnProperty.call(container, key) || edit.op === "set" && Object.is(container[key], edit.value)) return current;
    const next = Array.isArray(container) ? [...container] : { ...container };
    if (Array.isArray(next) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= next.length)) throw new Error("Invalid array address.");
    if (edit.op === "remove") {
      if (Array.isArray(next)) next.splice(Number(key), 1);
      else delete next[key];
    } else Object.defineProperty(next, key, { value: structuredClone(edit.value), enumerable: true, writable: true, configurable: true });
    return container === current ? next : { ...current, $: next };
  });
}

export function applyFormChange(data: SqueedJson, request: Omit<FormChange, "data" | "previousValue">, handler?: (event: FormChange) => FormEdit[] | void): SqueedJson {
  let next = applyEdit(data, request.value === undefined ? { op: "remove", address: request.address } : { op: "set", address: request.address, value: request.value });
  const edits = handler?.({ ...request, previousValue: readOnlyFormData(getNode(data, request.address)), data: readOnlyFormData(next) });
  if (edits && !Array.isArray(edits)) throw new Error("Form change handlers must return edits synchronously.");
  for (const edit of Array.isArray(edits) ? edits : []) {
    if (edit.op !== "set" && edit.op !== "remove") throw new Error("Unsupported form edit.");
    next = applyEdit(next, edit);
  }
  return next;
}