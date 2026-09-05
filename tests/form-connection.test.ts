import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readFormSchema } from "../src/core/forms";
import { compileSqueed } from "../src/core/squeedEdits";
import { resolveStateView } from "../src/utils/formState";

test("form connection sample binds UI node, named interface and independent state", async () => {
  const read = (name: string) =>
    JSON.parse(readFileSync(`examples/form-connection/${name}.json`, "utf8"));
  const bindings = read("bindings");
  const source = readFileSync("examples/form-connection/interface.ts", "utf8");
  const schema = await readFormSchema(
    { name: "interface.ts", size: source.length, text: async () => source },
    [bindings["root.form"].type],
  );
  assert.equal(bindings["root.form"].address, "root.step");
  assert.deepEqual(Object.keys(schema.SampleStep.properties), [
    "name",
    "enabled",
    "retries",
  ]);
  const graph = compileSqueed(resolveStateView(read("ui"), read("state")));
  assert.ok(graph.nodes.some((node) => node.data.id === "root.form"));
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.data.source === "root.binding" && edge.data.target === "root.form",
    ),
  );
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.data.source === "root.ui" &&
        edge.data.target === "root.binding" &&
        edge.data.label === "node address",
    ),
  );
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.data.source === "root.interface" &&
        edge.data.target === "root.form",
    ),
  );
});
