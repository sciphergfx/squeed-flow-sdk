import assert from "node:assert/strict";
import test from "node:test";
import { connectionIssue, parseJsonContract, parseTypeScriptContract } from "../src/core/workflowContract";

test("contracts reject unsupported, recursive and contradictory declarations", async () => {
  for (const schema of [
    { type: [] },
    { type: "string", properties: { value: { type: "string" } } },
    { anyOf: [{ type: "string" }], properties: {} },
    { const: "ok", enum: ["no"] },
    { type: "object", properties: {}, additionalProperties: false },
    { type: "object", properties: { alpha: { $ref: "#/properties/alpha" } } },
  ]) assert.throws(() => parseJsonContract(JSON.stringify(schema), "bad.json"));
  await assert.rejects(parseTypeScriptContract("interface Graph { alpha: Graph }", "bad.ts"), /Recursive/);
  await assert.rejects(parseTypeScriptContract("globalThis.executed = true; interface Graph {}", "bad.ts"), /executable/);
  const properties = Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`value${index}`, { type: "string" }]));
  assert.throws(() => parseJsonContract(JSON.stringify({ type: "object", properties }), "large.json"), /expansion limit/);
});

test("JSON contracts validate direction, optionality and missing properties", () => {
  const contract = parseJsonContract(JSON.stringify({ type: "object", properties: {
    alpha: { type: "object", properties: { value: { type: "string" }, optional: { type: "string" } }, required: ["value"] },
    beta: { type: "object", properties: { text: { type: "string" }, count: { type: "number" } }, required: ["text", "count"] },
  } }), "contract.json");
  const edge = { id: "edge", source: "root.alpha", target: "root.beta", sourceProperty: "value", targetProperty: "text" };
  assert.equal(connectionIssue(contract, edge), undefined);
  assert.match(connectionIssue(contract, { ...edge, targetProperty: "count" })!, /Incompatible/);
  assert.match(connectionIssue(contract, { ...edge, sourceProperty: "optional" })!, /Optional/);
  assert.match(connectionIssue(contract, { ...edge, targetProperty: "missing" })!, /Unverified/);
});

test("TypeScript interfaces support aliases, unions, arrays and nested objects", async () => {
  const contract = await parseTypeScriptContract('interface Graph { alpha: Source; beta: Target } interface Source { value: { name: "ok" }[]; wide: string | number } interface Target { value: { name: string }[]; narrow: string }', "graph.ts");
  const edge = { id: "edge", source: "alpha", target: "beta", sourceProperty: "value", targetProperty: "value" };
  assert.equal(connectionIssue(contract, edge), undefined);
  assert.match(connectionIssue(contract, { ...edge, sourceProperty: "wide", targetProperty: "narrow" })!, /Incompatible/);
  await assert.rejects(parseTypeScriptContract("interface Graph { alpha: any }", "bad.ts"), /Unsupported/);
  assert.throws(() => parseJsonContract('{"type":"string","minLength":2}', "bad.json"), /Unsupported/);
});