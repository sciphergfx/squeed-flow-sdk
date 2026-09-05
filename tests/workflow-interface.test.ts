import assert from "node:assert/strict";
import { test } from "node:test";
import { connectionIssue } from "../src/core/workflowContract";
import { readWorkflowInterface } from "../src/core/workflowInterface";

test("one interface supplies forms and validation at bound node addresses", async () => {
  const data = {
    workflow: {
      $form: { $type: "Workflow", $create: { $type: "Step" } },
      name: "Orders",
      steps: [{ id: "check", retry: { attempts: 3 } }],
    },
  };
  const file = new File(
    [
      "interface Workflow { name: string; steps: Step[] } interface Step { id: string; retry: { attempts: number } }",
    ],
    "workflow.ts",
  );
  const { schema, contract } = await readWorkflowInterface(file, data);
  assert.deepEqual(Object.keys(schema!), ["Workflow", "Step"]);
  assert.equal(contract.nodes["root.workflow"].type, schema!.Workflow);
  assert.equal(contract.nodes["root.workflow.steps.0"].type.kind, "object");
  const edge = {
    id: "mapping",
    source: "root.workflow",
    sourceProperty: "name",
    target: "root.workflow.steps.0",
    targetProperty: "id",
  };
  assert.equal(connectionIssue(contract, edge), undefined);
  assert.match(
    connectionIssue(contract, {
      ...edge,
      target: "root.workflow.steps.0.retry",
      targetProperty: "attempts",
    })!,
    /Incompatible property types/,
  );
});

test("unbound graphs retain the existing Graph contract upload", async () => {
  const file = new File(
    ["interface Graph { alpha: { value: string } }"],
    "graph.ts",
  );
  const result = await readWorkflowInterface(file, { alpha: { value: "ok" } });
  assert.equal(result.schema, undefined);
  assert.equal(result.contract.nodes.alpha.type.kind, "object");
});

test("missing creation types reject the whole interface upload", async () => {
  const data = {
    workflow: { $form: { $type: "Workflow", $create: { $type: "Step" } } },
  };
  const file = new File(
    [
      JSON.stringify({
        type: "object",
        properties: {
          Workflow: {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
      }),
    ],
    "workflow.json",
  );
  await assert.rejects(
    readWorkflowInterface(file, data),
    /Missing form type: Step/,
  );
});
