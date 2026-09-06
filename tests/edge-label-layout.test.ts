import assert from "node:assert/strict";
import { test } from "node:test";
import { measureEdgeLabel } from "../src/engine/edgeLabel";
import { runDagreLayout } from "../src/engine/layout";

const label = "{{steps.normalize_status.result}} == 'passed'";
const nodes = [
  { id: "source", width: 360, height: 300 },
  { id: "target", width: 360, height: 300 },
];

for (const rankDir of ["LR", "RL", "TB", "BT"] as const) {
  test(`${rankDir} reserves the long label's measured length between nodes`, () => {
    const options = {
      rankDir,
      rankSep: 150,
      edgeSep: 250,
      nodeSep: 5,
      spacingFactor: 1.3,
    };
    const edge = { id: "condition", source: "source", target: "target" };
    const unlabelled = runDagreLayout(nodes, [edge], options);
    const labelled = runDagreLayout(nodes, [{ ...edge, label }], options);
    const axis = rankDir === "LR" || rankDir === "RL" ? "x" : "y";
    const size = axis === "x" ? 360 : 300;
    const gap =
      Math.abs(labelled.get("source")![axis] - labelled.get("target")![axis]) -
      size;
    assert.ok(gap >= measureEdgeLabel(label).width + 100);
    assert.ok(
      gap >
        Math.abs(
          unlabelled.get("source")![axis] - unlabelled.get("target")![axis],
        ) -
          size,
    );
    assert.deepEqual(
      runDagreLayout(nodes, [{ ...edge, label: "" }], options),
      unlabelled,
    );
  });
}

test("label measurement includes wrapping, icon width, and padding without changing text", () => {
  const text = measureEdgeLabel(label);
  const withIcon = measureEdgeLabel(label, "PiCheck");
  assert.equal(text.lines.join(" "), label);
  assert.ok(text.width > 200);
  assert.equal(withIcon.width, text.width + 60);
  assert.equal(text.height, text.lines.length * 45 + 30);
  assert.equal(measureEdgeLabel().width, 0);
});

test("label edits reserve new space and removing a label restores the unlabelled layout", () => {
  const options = {
    rankDir: "LR" as const,
    rankSep: 150,
    edgeSep: 250,
    nodeSep: 5,
    spacingFactor: 1.3,
  };
  const edge = {
    id: "condition",
    source: "source",
    target: "target",
    label: "Short",
  };
  const before = runDagreLayout(nodes, [edge], options);
  const after = runDagreLayout(
    nodes,
    [{ ...edge, label, data: { icon: "PiCheck" } }],
    options,
  );
  assert.ok(
    after.get("target")!.x - after.get("source")!.x >
      before.get("target")!.x - before.get("source")!.x,
  );
  assert.equal(edge.label, "Short");
  assert.deepEqual(
    runDagreLayout(nodes, [{ ...edge, label: undefined }], options),
    runDagreLayout(
      nodes,
      [{ id: edge.id, source: edge.source, target: edge.target }],
      options,
    ),
  );
});
