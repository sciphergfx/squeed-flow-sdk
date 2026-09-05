import { v4 as uuid } from "uuid";
import { addChild, addConnection, getNode, updateNode, type SqueedJson } from "./squeedEdits";
import { formValueError, resolveFormNode, type FormBinding, type FormSchema } from "./forms";
import type { ContractType } from "./workflowContract";

function initialValue(type: ContractType): unknown {
  if (type.kind === "literal") return type.value;
  if (type.kind === "union") return initialValue(type.types[0]);
  if (type.kind === "array") return [];
  if (type.kind === "object") return Object.fromEntries(Object.entries(type.properties)
    .filter(([, property]) => !property.optional).map(([key, property]) => [key, initialValue(property.type)]));
  if (type.kind === "boolean") return false;
  if (type.kind === "number" || type.kind === "integer") return 0;
  return type.kind === "null" ? null : "";
}

export function createFormNode(document: SqueedJson, source: string, schema?: FormSchema) {
  const binding = getNode(document, source)?.$form as FormBinding | undefined;
  const creation = binding?.$create;
  if (!creation) return undefined;
  const parts = creation.$address.split(".");
  if (parts.shift() !== "root" || !parts.length || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part) || ["__proto__", "constructor", "prototype"].includes(part)))
    throw new Error("Invalid form creation address.");
  if (!schema || !Object.prototype.hasOwnProperty.call(schema, creation.$type)) throw new Error(`Load form type: ${creation.$type}`);
  const field = parts.pop()!;
  const parent = ["root", ...parts].join(".");
  const owner = resolveFormNode(document, parent, schema);
  const arrayType = owner?.type.properties[field]?.type;
  if (arrayType?.kind !== "array" || arrayType.items.kind !== "object") throw new Error("Form creation must target an object-array field.");
  const type = schema[creation.$type];
  const defaults = creation.$defaults ?? {};
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(type.properties, key) || formValueError(type.properties[key].type, value, !type.properties[key].optional))
      throw new Error(`Invalid creation default: ${key}`);
  }
  const item = { ...(initialValue(type) as Record<string, unknown>), ...structuredClone(defaults) };
  if (type.properties.id?.type.kind === "string") item.id = uuid();
  let next = document;
  const existing = getNode(document, creation.$address);
  if (existing === undefined) next = updateNode(document, parent, current => ({ ...current, [field]: [] }));
  else if (!Array.isArray(existing) && !Array.isArray(existing?.$)) throw new Error("Form creation destination is not an array.");
  const result = addChild(next, creation.$address, {
    ...item,
    $label: creation.$label ?? creation.$type,
    ...(creation.$icon ? { $icon: creation.$icon } : {}),
    $form: { $type: creation.$type, $create: creation },
  });
  return { address: result.address, json: addConnection(result.json, source, { target: result.address, label: creation.$edgeLabel }) };
}