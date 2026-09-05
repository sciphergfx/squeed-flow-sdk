import assert from "node:assert/strict";
import { test } from "node:test";
import { compileSqueed } from "../src/core/squeedEdits";
import { bindSqueedCallbacks } from "../src/core/squeedBinding";
import type { SqueedJson } from "../src/core/squeedEdits";

test("property connections compile separately from object data and legacy links", () => {
  const document = {
    backend: {
      runtime: "Node",
      api: "REST",
      $target: "root.other",
      $connections: [
        {
          sourceProperty: "api",
          target: "root.handlers",
          targetProperty: "http",
        },
        {
          sourceProperty: "runtime",
          target: "root.handlers",
          targetProperty: "ws",
        },
      ],
    },
    handlers: { http: "express", ws: "socket.io" },
    other: {},
  };
  const before = structuredClone(document);
  const graph = compileSqueed(document);
  const mappings = graph.edges.filter(
    (edge) => edge.data.sourceProperty !== undefined,
  );
  assert.equal(mappings.length, 2);
  assert.deepEqual(
    mappings.map(({ data }) => [
      data.source,
      data.sourceProperty,
      data.target,
      data.targetProperty,
    ]),
    [
      ["root.backend", "api", "root.handlers", "http"],
      ["root.backend", "runtime", "root.handlers", "ws"],
    ],
  );
  assert.equal(
    new Set(graph.edges.map((edge) => edge.data.id)).size,
    graph.edges.length,
  );
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.data.source === "root.backend" &&
        edge.data.target === "root.other",
    ),
  );
  assert.ok(
    graph.nodes.every((node) => !node.data.id.includes("$connections")),
  );
  assert.deepEqual(
    graph.nodes.find((node) => node.data.id === "root.backend")?.data
      .description,
    { runtime: "Node", api: "REST" },
  );
  assert.deepEqual(document, before);
  assert.deepEqual(
    compileSqueed(document).edges.map((edge) => edge.data.id),
    graph.edges.map((edge) => edge.data.id),
  );
});

test("dragged property mappings append and round trip without replacing sibling links", () => {
  const original = {
    source: { first: 1, second: 2, $target: "root.legacy" },
    target: { input: 0 },
    legacy: {},
  };
  let latest: SqueedJson = original;
  const changes: string[] = [];
  const callbacks = bindSqueedCallbacks(original, [], {}, (next, change) => {
    latest = next;
    changes.push(change.key!);
  });
  callbacks.onEdgeCreate!("root.source", "root.target", {
    sourceProperty: "first",
    targetProperty: "input",
  });
  callbacks.onEdgeCreate!("root.source", "root.target", {
    sourceProperty: "second",
    targetProperty: "input",
  });
  callbacks.onEdgeCreate!("root.source", "root.target", {
    sourceProperty: "first",
    targetProperty: "input",
  });
  assert.equal(latest.source.$connections.length, 2);
  assert.equal(latest.source.$target, "root.legacy");
  assert.deepEqual(changes, ["$connections", "$connections"]);
  const compiled = compileSqueed(latest);
  const mappings = compiled.edges.filter((edge) => edge.data.connection);
  const edits = bindSqueedCallbacks(latest, compiled.edges, {}, (next) => {
    latest = next;
  });
  edits.onEdgeLabelChange!(mappings[0].data.id, "mapped");
  edits.onEdgeColorChange!(mappings[0].data.id, "green.500");
  edits.onEdgeStyleChange!(mappings[0].data.id, "animated");
  assert.equal(latest.source.$connections[0].label, "mapped");
  assert.equal(latest.source.$connections[0].style, "animated");
  assert.equal(latest.source.$connections[1].label, undefined);
  const rendered = compileSqueed(latest).edges.find(
    (edge) => edge.data.id === mappings[0].data.id,
  )!;
  assert.equal(rendered.data.color, "green.500");
  assert.equal(rendered.data.isEdgeAnimated, true);
  edits.onEdgeDelete!(mappings[0].data.id, mappings[0].data);
  assert.ok(
    compileSqueed(latest).edges.some(
      (edge) => edge.data.id === mappings[1].data.id,
    ),
  );
  edits.onEdgeDelete!(mappings[1].data.id, mappings[1].data);
  assert.equal(latest.source.$connections, undefined);
  assert.equal(latest.source.$target, "root.legacy");
  assert.equal("$connections" in original.source, false);
});

test("wrapped arrays and hidden or missing targets preserve mapping metadata", () => {
  const document = {
    group: {
      $: [
        {
          value: 1,
          $connections: [
            {
              sourceProperty: "value",
              target: "root.target",
              targetProperty: "value",
            },
          ],
        },
      ],
    },
    target: { value: 2 },
  };
  const graph = compileSqueed(document);
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.data.source === "root.group.0" &&
        edge.data.targetProperty === "value",
    ),
  );
  const hidden = compileSqueed({
    ...document,
    group: { ...document.group, $collapsed: true },
  });
  assert.ok(!hidden.edges.some((edge) => edge.data.connection));
  const missing = compileSqueed({
    source: {
      value: 1,
      $connections: [{ target: "root.missing", targetProperty: "value" }],
    },
  });
  assert.ok(!missing.edges.some((edge) => edge.data.connection));
});
