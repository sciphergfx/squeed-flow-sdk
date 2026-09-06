import assert from "node:assert/strict";
import { test } from "node:test";
import {
  suggestionBindings,
  resolveWorkflowSuggestions,
  suggestionField,
} from "../../../backflow/backflow-admin/src/pages/sdk-test/workflowFormSuggestions";

test("database collection suggestions reuse workflow metadata and exact JSON addresses", async () => {
  const request = {
    address: "root.workflow.steps.0.config.collection",
    nodeAddress: "root.workflow.steps.0.config",
    data: {
      workflow: { steps: [{ type: "database", config: { collection: "" } }] },
    },
    signal: new AbortController().signal,
  };
  const calls: unknown[] = [];
  const load = async (source: unknown) => {
    calls.push(source);
    return {
      data: [
        { collection: "orders" },
        { collection: "users" },
        { collection: "orders" },
      ],
    };
  };
  assert.deepEqual(await resolveWorkflowSuggestions(request, {}, load), [
    { label: "orders", value: "orders" },
    { label: "users", value: "users" },
  ]);
  assert.deepEqual(calls, [
    { url: "/tenant/entities", dataPath: "data", valueKey: "collection" },
  ]);
  const explicit = {
    ...request,
    address: "root.arbitrary.table",
    nodeAddress: "root.arbitrary",
    data: { arbitrary: {} },
  };
  assert.equal(suggestionField(explicit), undefined);
  assert.equal(
    (
      await resolveWorkflowSuggestions(
        explicit,
        { [explicit.address]: { action: "database", field: "collection" } },
        load,
      )
    )?.length,
    2,
  );
});

test("suggestions preserve resource callbacks and reject malformed responses and cancellation", async () => {
  const request = {
    address: "root.step.config.collection",
    nodeAddress: "root.step.config",
    data: { step: { action: "database", config: {} } },
    signal: new AbortController().signal,
  };
  const binding = {
    address: request.nodeAddress,
    type: "Database",
    fields: { collection: { $label: "Collections" } },
  };
  const schema: any = {
    Database: {
      kind: "object",
      properties: { collection: { type: { kind: "string" } } },
    },
  };
  assert.equal(
    suggestionBindings({ "root.step": binding }, request.data, schema, {})[
      "root.step"
    ].fields.collection.$options?.$source,
    "callback",
  );
  await assert.rejects(
    resolveWorkflowSuggestions(request, {}, async () => ({ unexpected: [] })),
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    resolveWorkflowSuggestions(
      { ...request, signal: controller.signal },
      {},
      async () => {
        throw new Error("Must not fetch");
      },
    ),
  );
});
