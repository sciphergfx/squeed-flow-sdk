import assert from "node:assert/strict";
import { test } from "node:test";
import type { FormSchema } from "../src/core/forms";
import { projectStructuredForms } from "../src/utils/structuredForms";

const schema: FormSchema = {
  Registry: {
    kind: "object",
    properties: {
      tools: {
        optional: false,
        type: {
          kind: "object",
          properties: {},
          additionalProperties: {
            kind: "object",
            properties: { name: { type: { kind: "string" }, optional: false } },
          },
        },
      },
    },
  },
};
const state = {
  tools: { lookup: { name: "Lookup" }, search: { name: "Search" } },
};
const nodes = [
  {
    data: { id: "root.tools", type: "arrayView", config: { labelBelow: true } },
  },
];

test("structured forms preserve an explicitly grouped resource registry", () => {
  const binding = {
    address: "root",
    type: "Registry",
    portResources: {
      "output:lookup": "root.tools.lookup",
      "output:search": "root.tools.search",
    },
  };
  const projected = projectStructuredForms(
    state,
    { "root.tools": binding },
    schema,
    nodes,
  );
  assert.deepEqual(projected.nodes, []);
  assert.deepEqual(projected.edges, []);
  assert.equal(projected.bindings["root.tools"], binding);
  assert.equal(projected.schema.Registry, schema.Registry);
  assert.equal(projected.slots.size, 0);
});

test("ordinary structured forms still expand nested objects", () => {
  const projected = projectStructuredForms(
    state,
    {
      "root.tools": { address: "root", type: "Registry" },
    },
    schema,
    nodes,
  );
  assert.ok(projected.nodes.length > 0);
  assert.ok(projected.edges.length > 0);
});
