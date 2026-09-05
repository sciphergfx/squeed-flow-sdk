import { readFormSchema, resolveFormNode, type FormSchema } from "./forms";
import type { SqueedJson } from "./squeedEdits";
import { readWorkflowContract, type WorkflowContract } from "./workflowContract";

export async function readWorkflowInterface(file: File, data?: SqueedJson): Promise<{
  contract: WorkflowContract;
  schema?: FormSchema;
}> {
  const names = new Set<string>();
  const addresses: string[] = [];
  const visit = (value: unknown, address: string) => {
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, any>;
    addresses.push(address);
    if (typeof object.$form?.$type === "string") names.add(object.$form.$type);
    if (typeof object.$form?.$create?.$type === "string") names.add(object.$form.$create.$type);
    for (const [key, child] of Object.entries(object)) {
      if (key === "$") visit(child, address);
      else if (!key.startsWith("$")) visit(child, `${address}.${key}`);
    }
  };
  visit(data, "root");
  if (!names.size) return { contract: await readWorkflowContract(file) };
  const schema = await readFormSchema(file, [...names]);
  for (const name of names)
    if (!Object.prototype.hasOwnProperty.call(schema, name))
      throw new Error(`Missing form type: ${name}`);
  const nodes: WorkflowContract["nodes"] = {};
  for (const address of addresses) {
    const resolved = resolveFormNode(data!, address, schema);
    if (resolved) nodes[address] = { type: resolved.type, optional: false };
  }
  return { schema, contract: { name: file.name, nodes } };
}