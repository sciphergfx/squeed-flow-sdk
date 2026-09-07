import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseTypeScriptForm } from "../src/core/workflowContract";
import { projectWorkflowPorts } from "../examples/workflow-state/ports";

test("port labels preserve schema names and projected connection identifiers", async () => {
  const schema = await parseTypeScriptForm(
    '/** @port output resource "Display output" */\ninterface Resource { resource: string; }',
    "resource.ts", "Resource", { allowJson: true },
  );
  assert.deepEqual(schema.ports, { resource: { kind: "output", label: "Display output" } });
  assert.ok(schema.properties.resource);
  const connection = { sourceProperty: "output:resource", target: "root.consumer" };
  const view = { resource: { $connections: [connection] }, consumer: {} };
  for (const direction of ["LR", "RL", "TB", "BT"] as const) {
    const projected = projectWorkflowPorts(view, { Resource: schema }, direction, {
      "root.resource": { address: "root.resource", type: "Resource" },
    });
    assert.equal(projected.resource.$ports[0].id, "output:resource");
    assert.equal(projected.resource.$ports[0].label, "Display output");
    assert.deepEqual(projected.resource.$connections, [connection]);
  }
  assert.equal("$ports" in view.resource, false);
});

test("unlabeled ports remain compatible and invalid labels are rejected", async () => {
  const parse = (suffix: string) => parseTypeScriptForm(
    `/** @port output resource${suffix} */\ninterface Resource { name: string; }`,
    "resource.ts", "Resource", { allowJson: true },
  );
  assert.deepEqual((await parse("")).ports, { resource: { kind: "output" } });
  for (const suffix of [" false", " 1", " null", " {}", " invalid"]) {
    await assert.rejects(() => parse(suffix));
  }
});

for (const [directory, names] of [
  ["workflow-state", ["ToolConfig", "ModelConfig", "MemoryConfig", "TextConfig"]],
  ["workflow-state-2", ["CastFilterConfig", "CastSortConfig", "CastDataConfig", "CastToolConfig"]],
] as const) {
  test(`${directory} labels every declared resource output`, async () => {
    const source = readFileSync(`examples/${directory}/interface.ts`, "utf8");
    for (const name of names) {
      const schema = await parseTypeScriptForm(source, "interface.ts", name, { allowJson: true });
      assert.deepEqual(schema.ports?.resource, { kind: "output", label: "output" });
    }
  });
}