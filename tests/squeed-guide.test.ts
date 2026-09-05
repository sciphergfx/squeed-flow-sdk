import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import guide from "../examples/squeed.json";
import { compileSqueed, type SqueedJson } from "../src/core/squeedEdits";

test("Squeed guide compiles without mutation and exposes every expanded topic", () => {
  const original = structuredClone(guide);
  const collapsed = compileSqueed(guide);
  const expanded: SqueedJson = structuredClone(guide);
  const topics: string[] = [];
  for (const chapter of Object.values(expanded)) {
    if (!chapter || typeof chapter !== "object") continue;
    assert.equal(chapter.$collapsed, true);
    chapter.$collapsed = false;
    for (const [key, topic] of Object.entries(chapter)) {
      if (key.startsWith("$") || !topic || typeof topic !== "object") continue;
      topics.push((topic as { $content: string }).$content);
    }
  }
  const graph = compileSqueed(expanded);
  assert.ok(topics.length >= 20);
  assert.ok(graph.nodes.length > collapsed.nodes.length);
  assert.equal(
    new Set(graph.nodes.map((node) => node.data.id)).size,
    graph.nodes.length,
  );
  const renderedContent = graph.nodes.map((node) => node.data.config?.content);
  for (const content of topics) assert.ok(renderedContent.includes(content));
  const ids = new Set(graph.nodes.map((node) => node.data.id));
  for (const edge of graph.edges) {
    assert.ok(ids.has(edge.data.source));
    assert.ok(ids.has(edge.data.target));
  }
  assert.deepEqual(guide, original);
});

test("file map paths and import/export arrows match the source tree", () => {
  const entries = Object.entries(guide.fileMap).filter(
    ([, value]) => typeof value === "object" && value !== null,
  );
  const files = new Map(
    entries.map(([key, value]) => [
      `root.fileMap.${key}`,
      value as {
        path: string;
        $connections?: { target: string; label: string; style?: string }[];
      },
    ]),
  );
  assert.ok(files.size >= 40);
  let sourceLinks = 0;
  for (const entry of files.values()) {
    const path = resolve(entry.path);
    assert.ok(existsSync(path), `Missing documented file: ${entry.path}`);
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const connection of entry.$connections ?? []) {
      const target = files.get(connection.target);
      assert.ok(target, `Missing target: ${connection.target}`);
      const kind = connection.label.split(":")[0];
      assert.ok(["IMPORT", "TYPE", "EXPORT", "BUILD", "TEST"].includes(kind));
      if (kind === "BUILD" || kind === "TEST") continue;
      const linked = source.statements.some((statement) => {
        if (
          !ts.isImportDeclaration(statement) &&
          !ts.isExportDeclaration(statement)
        )
          return false;
        if (
          kind === "EXPORT"
            ? !ts.isExportDeclaration(statement)
            : !ts.isImportDeclaration(statement)
        )
          return false;
        const specifier = statement.moduleSpecifier;
        if (
          !specifier ||
          !ts.isStringLiteral(specifier) ||
          !specifier.text.startsWith(".")
        )
          return false;
        const base = resolve(dirname(path), specifier.text);
        const candidates = [
          base,
          `${base}.ts`,
          `${base}.tsx`,
          resolve(base, "index.ts"),
          resolve(base, "index.tsx"),
        ];
        if (!candidates.includes(resolve(target.path))) return false;
        if (ts.isImportDeclaration(statement)) {
          const clause = statement.importClause;
          const named = clause?.namedBindings;
          const typeOnly =
            !!clause?.isTypeOnly ||
            !!(
              named &&
              ts.isNamedImports(named) &&
              !clause?.name &&
              named.elements.length &&
              named.elements.every((element) => element.isTypeOnly)
            );
          if (kind === "TYPE") return typeOnly;
          return !typeOnly;
        }
        return true;
      });
      assert.ok(linked, `${entry.path}: stale ${kind} arrow to ${target.path}`);
      if (kind === "TYPE") assert.equal(connection.style, "dashed");
      sourceLinks++;
    }
  }
  assert.ok(sourceLinks >= 50);
});
