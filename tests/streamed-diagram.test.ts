import assert from "node:assert/strict";
import { test } from "node:test";
import { createStreamedDiagram } from "../../../backflow/backflow-admin/src/pages/sdk-test/streamedDiagram";

test("partial JSON is repaired for throttled previews and strictly committed only at completion", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const previews: unknown[] = [],
    commits: unknown[] = [];
  const stream = createStreamedDiagram({
    preview: (value) => previews.push(value),
    commit: (value) => commits.push(value),
  });
  stream.append('{"task":{"$label":"Hel');
  context.mock.timers.tick(149);
  assert.equal(previews.length, 0);
  context.mock.timers.tick(1);
  assert.deepEqual(previews, [{ task: { $label: "Hel" } }]);
  stream.append('lo"');
  stream.append('},"done":{}');
  context.mock.timers.tick(150);
  assert.equal(previews.length, 2);
  assert.equal(commits.length, 0);
  stream.append("}");
  stream.finish();
  assert.deepEqual(commits, [{ task: { $label: "Hello" }, done: {} }]);
  context.mock.timers.tick(150);
  assert.equal(previews.length, 2);
});

test("truncated, unsafe and primitive finals never commit; cancellation and size limits stop previews", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  for (const source of [
    '{"node":',
    '{"__proto__":{}}',
    "42",
    '{"node":NaN}',
    '{"node":{"$label":{}}}',
    '{"node":{"$media":"https://example.invalid"}}',
  ]) {
    const stream = createStreamedDiagram({
      preview: () => {},
      commit: () => assert.fail("Invalid final committed"),
    });
    stream.append(source);
    assert.throws(() => stream.finish());
  }
  const stream = createStreamedDiagram({
    preview: () => assert.fail("Cancelled preview"),
    commit: () => assert.fail("Cancelled commit"),
  });
  stream.append('{"node":{}}');
  stream.cancel();
  context.mock.timers.tick(1000);
  assert.throws(() => stream.finish());
  const limited = createStreamedDiagram({
    preview: () => assert.fail("Oversized preview"),
    commit: () => {},
    maxBytes: 5,
  });
  assert.throws(() => limited.append('"ééé"'), /size limit/);
  context.mock.timers.tick(1000);
});

test("cumulative snapshots replace the buffer, retain the last valid preview and accept a fresh model fallback", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const previews: unknown[] = [];
  const stream = createStreamedDiagram({
    preview: (value) => previews.push(value),
    commit: (value) => previews.push(value),
  });
  stream.snapshot('{"node":{"$label":"Good"}}');
  context.mock.timers.tick(150);
  stream.snapshot('{"node":{"$label":{}}}');
  context.mock.timers.tick(150);
  assert.equal(previews.length, 1);
  stream.snapshot('{"other":{}}');
  stream.finish();
  assert.deepEqual(previews, [{ node: { $label: "Good" } }, { other: {} }]);
});
