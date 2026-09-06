import assert from "node:assert/strict";
import { test } from "node:test";
import { createFlowDocumentActions, parseFlowDocument } from "../src/core/documentActions";

test("document actions deliver immediate controlled replacements without schema assumptions", () => {
  const json = { item: { $label: "Before" } }, state = { arbitrary: { title: "Before" } };
  const events: unknown[] = [];
  const actions = createFlowDocumentActions({ json, state, onJsonChange: (next, change) => events.push([next, change]), onStateChange: (next, change) => events.push([next, change]) });
  const document = { item: { $label: "After", $bgColor: "teal.500" } };
  const next = actions.replaceJson(document);
  assert.notEqual(next, document);
  assert.deepEqual(events[0], [document, { type: "documentReplace", address: "root" }]);
  actions.replaceState({ arbitrary: { title: "After" } });
  assert.equal(events.length, 2);
  assert.equal(state.arbitrary.title, "Before");
  assert.equal(json.item.$label, "Before");
});

test("invalid JSON or read-only replacements do not notify the client", () => {
  let calls = 0;
  const actions = createFlowDocumentActions({ onJsonChange: () => calls++ });
  for (const input of [null, 12, { value: Infinity }, { value: undefined }]) assert.throws(() => actions.replaceJson(input));
  assert.throws(() => parseFlowDocument('{"incomplete":'));
  assert.throws(() => parseFlowDocument('{"__proto__":{}}'));
  assert.throws(() => createFlowDocumentActions({ readOnly: true, onJsonChange: () => calls++ }).replaceJson({}));
  assert.throws(() => actions.replaceState({}));
  assert.deepEqual(parseFlowDocument('[{"label":"Example"}]'), [{ label: "Example" }]);
  assert.equal(calls, 0);
});