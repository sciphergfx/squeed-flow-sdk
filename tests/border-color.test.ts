import assert from "node:assert/strict";
import { test } from "node:test";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import { compileSqueed, type SqueedJson } from "../src/core/squeedEdits";

test("border callbacks compose without changing fill/text or notifying legacy color handlers", () => {
  const original = {
    first: {
      $outline: true,
      $bgColor: "blue.500",
      $textColor: "white",
      $isNodeAnimated: true,
    },
    second: { $outline: true, $bgColor: "teal.500" },
  };
  let latest: SqueedJson = original;
  const events: unknown[] = [];
  const callbacks = bindSqueedCallbacks(
    original,
    [],
    {
      onNodeBorderColorChange: (id, color) => events.push([id, color]),
      onNodeColorChange: () =>
        assert.fail(
          "Existing text/background callbacks must not receive border changes",
        ),
    },
    (next, change) => {
      latest = next;
      events.push([change.type, change.key]);
    },
  );
  callbacks.onNodeBorderColorChange!("root.first", "red.500");
  callbacks.onNodeBorderColorChange!("root.second", "transparent");
  assert.deepEqual(latest, {
    first: { ...original.first, $borderColor: "red.500" },
    second: { ...original.second, $borderColor: "transparent" },
  });
  assert.deepEqual(events, [
    ["root.first", "red.500"],
    ["nodeColor", "$borderColor"],
    ["root.second", "transparent"],
    ["nodeColor", "$borderColor"],
  ]);
  const first = compileSqueed(latest).nodes.find(
    (node) => node.data.id === "root.first",
  )!;
  assert.equal(first.data.viewProps.borderColor, "red.500");
  assert.equal(first.data.isNodeAnimated, true);
  callbacks.onNodeBorderColorChange!("root.first", "");
  assert.deepEqual(latest.first, original.first);
  assert.equal(latest.second.$borderColor, "transparent");
  assert.equal("$borderColor" in original.first, false);
});
