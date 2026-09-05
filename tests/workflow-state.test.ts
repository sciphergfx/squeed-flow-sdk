import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readFormSchema } from "../src/core/forms";
import { compileSqueed } from "../src/core/squeedEdits";
import { resolveStateView } from "../src/utils/formState";

test("separate workflow example compiles and loads its bound interfaces", async () => {
  const read = (name: string) =>
    JSON.parse(readFileSync(`examples/workflow-state/${name}.json`, "utf8"));
  const state = read("state");
  const view = read("view");
  const bindings = read("bindings");
  const source = readFileSync("examples/workflow-state/interface.ts", "utf8");
  const schema = await readFormSchema(
    { name: "interface.ts", size: source.length, text: async () => source },
    Object.values(bindings).map((binding: any) => binding.type),
  );
  assert.equal(Object.keys(schema).length, 4);
  const compiled = compileSqueed(resolveStateView(view, state));
  for (const address of Object.keys(bindings))
    assert.ok(
      compiled.nodes.some((node) => node.data.id === address),
      address,
    );
  assert.ok(
    compiled.edges.some(
      (edge) =>
        edge.data.source === "root.decision" &&
        edge.data.target === "root.addChannel",
    ),
  );
  assert.equal(JSON.stringify(state).includes('"$'), false);
  assert.equal(JSON.stringify(view).includes('"$form"'), false);
});
