import assert from "node:assert/strict";
import { test } from "node:test";
import { createFormNode } from "../src/core/createFormNode";
import { readFormSchema } from "../src/core/forms";

test("schema creation appends sibling steps with stable IDs, forms and explicit links", async () => {
  const source =
    'interface Workflow { steps: Step[] } interface Step { id: string; name: string; type: "conditional" | "http" }';
  const schema = await readFormSchema(
    { name: "workflow.ts", size: source.length, text: async () => source },
    ["Workflow", "Step"],
  );
  const document = {
    workflow: {
      $form: {
        $type: "Workflow",
        $create: {
          $address: "root.workflow.steps",
          $type: "Step",
          $label: "Step",
          $defaults: { name: "New step", type: "conditional" },
          $edgeLabel: "Next",
        },
      },
      steps: [],
    },
  };
  const first = createFormNode(document, "root.workflow", schema)!;
  assert.equal(first.address, "root.workflow.steps.0");
  assert.equal(first.json.workflow.steps[0].$form.$type, "Step");
  assert.equal(first.json.workflow.$connections[0].target, first.address);
  const second = createFormNode(first.json, first.address, schema)!;
  assert.equal(second.address, "root.workflow.steps.1");
  assert.notEqual(
    second.json.workflow.steps[0].id,
    second.json.workflow.steps[1].id,
  );
  assert.equal(
    second.json.workflow.steps[0].$connections[0].target,
    second.address,
  );
  assert.deepEqual(document.workflow.steps, []);
  assert.equal(createFormNode({ plain: {} }, "root.plain", schema), undefined);
  assert.throws(
    () => createFormNode(document, "root.workflow"),
    /Load form type/,
  );
});
