import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFormChange,
  formOptions,
  formValueError,
  readFormSchema,
} from "../src/core/forms";

test("named interfaces and JSON schemas produce the same form model", async () => {
  const source =
    'interface Workflow { trigger: "manual" | "event"; eventName?: string }';
  const fromTs = await readFormSchema(
    { name: "form.ts", size: source.length, text: async () => source },
    ["Workflow"],
  );
  const schema = JSON.stringify({
    type: "object",
    properties: {
      Workflow: {
        type: "object",
        properties: {
          trigger: { enum: ["manual", "event"] },
          eventName: { type: "string" },
        },
        required: ["trigger"],
      },
    },
  });
  const fromJson = await readFormSchema(
    { name: "form.json", size: schema.length, text: async () => schema },
    [],
  );
  assert.deepEqual(fromTs, fromJson);
  assert.deepEqual(
    formOptions(fromTs.Workflow.properties.trigger.type)?.map(
      (option) => option.value,
    ),
    ["manual", "event"],
  );
  assert.equal(formValueError({ kind: "boolean" }, false, true), undefined);
  assert.equal(formValueError({ kind: "number" }, 0, true), undefined);
  assert.equal(
    formValueError({ kind: "number" }, NaN, true),
    "Expected number",
  );
});

test("form events atomically apply dependent edits without recursion or mutation", () => {
  const document = {
    workflow: { trigger: "event", eventName: "order.created" },
    sibling: { keep: true },
  };
  let calls = 0;
  const next = applyFormChange(
    document,
    {
      address: "root.workflow.trigger",
      nodeAddress: "root.workflow",
      value: "manual",
    },
    (event) => {
      calls++;
      assert.equal(event.previousValue, "event");
      assert.equal(event.data.workflow.trigger, "manual");
      assert.throws(() => {
        event.data.sibling.keep = false;
      }, /read-only/);
      return [{ op: "remove", address: "root.workflow.eventName" }];
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(next, {
    workflow: { trigger: "manual" },
    sibling: { keep: true },
  });
  assert.equal(document.workflow.eventName, "order.created");
  assert.throws(() =>
    applyFormChange(document, {
      address: "root.__proto__.polluted",
      nodeAddress: "root",
      value: true,
    }),
  );
  assert.throws(() =>
    applyFormChange(
      document,
      {
        address: "root.workflow.trigger",
        nodeAddress: "root.workflow",
        value: "manual",
      },
      () => [{ op: "set", address: "root.missing.value", value: 1 }],
    ),
  );
  assert.equal(document.workflow.trigger, "event");
});

test("form events change supported node colors atomically and reject arbitrary metadata", () => {
  const data = {
    step: { target: "local", $bgColor: "blue.500" },
    untouched: { value: 1 },
  };
  const request = {
    nodeAddress: "root.step",
    address: "root.step.target",
    value: "server",
  };
  const next = applyFormChange(data, request, () => [
    { op: "set", address: "root.step.$bgColor", value: "teal.500" },
    { op: "set", address: "root.step.$textColor", value: "white" },
    { op: "set", address: "root.step.$borderColor", value: "teal.700" },
  ]);
  assert.equal(next.step.$bgColor, "teal.500");
  assert.equal(next.untouched, data.untouched);
  assert.equal(data.step.target, "local");
  assert.throws(() =>
    applyFormChange(data, request, () => [
      { op: "set", address: "root.step.$form", value: {} },
    ]),
  );
});
