import assert from "node:assert/strict";
import { test } from "node:test";
import { readFormSchema } from "../src/core/forms";

const parse = (source: string) =>
  readFormSchema(
    { name: "ports.ts", size: source.length, text: async () => source },
    ["Agent"],
  );

test("TypeScript declares ports and scalar/list references without changing form fields", async () => {
  const schema = await parse(`
    interface Model { name: string }
    /**
     * @port input input
     * @port output output
     * @port error failure
     */
    interface Agent {
      /** @port config Model */
      model?: string;
      /** @port config Model */
      fallback?: string[];
      temperature?: number;
    }
  `);
  assert.deepEqual(schema.Agent.ports, {
    model: { kind: "config", resourceType: "Model", multiple: false },
    fallback: { kind: "config", resourceType: "Model", multiple: true },
    input: { kind: "input" },
    output: { kind: "output" },
    failure: { kind: "error" },
  });
  assert.equal(schema.Agent.properties.model.type.kind, "string");
  assert.equal(schema.Agent.properties.fallback.type.kind, "array");
  assert.equal(schema.Model.properties.name.type.kind, "string");
  assert.equal(
    (await parse("interface Agent { model?: string; }")).Agent.ports,
    undefined,
  );
});

test("malformed port declarations reject the upload", async () => {
  for (const source of [
    "interface Agent {\n/** @port config Missing */\nmodel: string; }",
    "interface Model {}\ninterface Agent {\n/** @port config Model */\nmodel: number; }",
    "/** @port other input */\ninterface Agent {}",
    "/** @port input input extra */\ninterface Agent {}",
    "/**\n * @port input same\n * @port output same\n */\ninterface Agent {}",
  ])
    await assert.rejects(parse(source), /port/i);
});
