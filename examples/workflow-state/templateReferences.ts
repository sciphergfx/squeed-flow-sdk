import type * as TypeScript from "typescript";
import type { FormSchema } from "../../src/core/forms";
import {
  getNode,
  removeNode,
  setNodeProp,
  type SqueedJson,
} from "../../src/core/squeedEdits";
import type { FlowDirection } from "../../src/types";
import type { StateFormBinding } from "../../src/utils/formState";
import { applyStateEdits } from "../../src/utils/formState";

export interface TemplateUse {
  path: string;
  target: string;
  property: string;
  row: boolean;
  address: string;
}

export interface TemplateGraph {
  uses: TemplateUse[];
  direction: FlowDirection;
  disconnected?: {
    address: string;
    before: string;
    after: string;
    path: string;
  }[];
}

export async function readTemplateUses(
  state: SqueedJson,
  view: SqueedJson,
  bindings: Record<string, StateFormBinding>,
  schema?: FormSchema,
): Promise<TemplateUse[]> {
  const ts = await import("typescript");
  const uses = new Map<string, TemplateUse>();
  const pathOf = (node: TypeScript.Node): string[] | undefined => {
    if (ts.isIdentifier(node)) return [node.text];
    if (ts.isPropertyAccessExpression(node)) {
      const parent = pathOf(node.expression);
      return parent && [...parent, node.name.text];
    }
    if (
      ts.isElementAccessExpression(node) &&
      (ts.isStringLiteral(node.argumentExpression) ||
        ts.isNumericLiteral(node.argumentExpression))
    ) {
      const parent = pathOf(node.expression);
      return parent && [...parent, node.argumentExpression.text];
    }
    return undefined;
  };
  const scan = (
    value: unknown,
    target: string,
    property: string,
    row: boolean,
    address: string,
  ) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
        const source = ts.createSourceFile(
          "template.ts",
          `(${match[1]})`,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS,
        );
        if (
          (source as unknown as { parseDiagnostics: unknown[] })
            .parseDiagnostics.length
        )
          continue;
        const visit = (node: TypeScript.Node) => {
          const path = pathOf(node);
          if (path && path.length > 1) {
            const use = {
              path: path.join("."),
              target,
              property,
              row,
              address,
            };
            uses.set(JSON.stringify(use), use);
            return;
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value))
        scan(child, target, property, row, `${address}.${key}`);
    }
  };
  for (const [target, binding] of Object.entries(bindings)) {
    if (!getNode(view, target)) continue;
    const config = getNode(state, binding.address);
    if (config && typeof config === "object")
      for (const [field, value] of Object.entries(config))
        if (
          !schema ||
          Object.prototype.hasOwnProperty.call(
            schema[binding.type]?.properties ?? {},
            field,
          )
        )
          scan(value, target, field, false, `${binding.address}.${field}`);
  }
  for (const [id, resource] of Object.entries(
    getNode(state, "root.sdkResources") ?? {},
  ) as [string, { value?: unknown }][]) {
    const target = `root.${id}`;
    if (!getNode(view, target)) continue;
    if (
      resource.value &&
      typeof resource.value === "object" &&
      !Array.isArray(resource.value)
    ) {
      for (const [field, value] of Object.entries(resource.value))
        scan(
          value,
          target,
          field,
          true,
          `root.sdkResources.${id}.value.${field}`,
        );
    } else
      scan(
        resource.value,
        target,
        "value",
        false,
        `root.sdkResources.${id}.value`,
      );
  }
  return [...uses.values()];
}

function sourceFor(
  use: TemplateUse,
  state: SqueedJson,
  bindings: Record<string, StateFormBinding>,
) {
  const [root, stepId, ...parts] = use.path.split(".");
  if (root === "steps") {
    for (const [address, binding] of Object.entries(bindings)) {
      const step = getNode(state, binding.address.replace(/\.config$/, ""));
      if (step?.id === stepId)
        return {
          node: address,
          property: `template:${parts.join(".")}`,
          runtime: false,
        };
    }
  }
  return {
    node: `root.template_${encodeURIComponent(root)}`,
    property: use.path.slice(root.length + 1),
    runtime: true,
  };
}

export function syncTemplateGraph(
  view: SqueedJson,
  state: SqueedJson,
  bindings: Record<string, StateFormBinding>,
  uses: TemplateUse[],
  direction: FlowDirection,
  previous?: TemplateGraph,
) {
  if (
    previous?.direction === direction &&
    JSON.stringify(previous.uses) === JSON.stringify(uses)
  )
    return { view, graph: previous };
  const outputSide =
    direction === "RL"
      ? "left"
      : direction === "TB"
        ? "bottom"
        : direction === "BT"
          ? "top"
          : "right";
  const edgeKey = (use: TemplateUse) =>
    `template:${JSON.stringify([use.path, use.target, use.property])}`;
  const previousKeys = new Set(previous?.uses.map(edgeKey));
  const nextKeys = new Set(uses.map(edgeKey));
  let next = view;
  const roots = new Map<string, Map<string, string>>();
  for (const use of uses) {
    const source = sourceFor(use, state, bindings);
    if (!source.runtime) continue;
    const fields = roots.get(source.node) ?? new Map<string, string>();
    fields.set(source.property, `{{${use.path}}}`);
    roots.set(source.node, fields);
  }
  const previousRoots = new Set(
    previous?.uses
      .map((use) => sourceFor(use, state, bindings))
      .filter((source) => source.runtime)
      .map((source) => source.node),
  );
  if (
    roots.size &&
    (!previous || !previousRoots.size) &&
    !getNode(next, "root.templateVariables")
  )
    next = { ...next, templateVariables: { $label: "Template Variables" } };
  for (const [address, fields] of roots) {
    const node = getNode(next, address);
    if (!node && previousRoots.has(address)) continue;
    const metadata = Object.fromEntries(
      Object.entries(node ?? {}).filter(([key]) => key.startsWith("$")),
    );
    next = {
      ...next,
      [address.slice(5)]: {
        $label: decodeURIComponent(address.slice("root.template_".length)),
        $icon: "PiBracketsCurly",
        $view: "object",
        ...(getNode(next, "root.templateVariables")
          ? { $parent: "root.templateVariables" }
          : {}),
        ...metadata,
        ...Object.fromEntries(fields),
      },
    };
  }
  for (const use of previous?.uses ?? []) {
    if (nextKeys.has(edgeKey(use))) continue;
    const source = sourceFor(use, state, bindings);
    const node = getNode(next, source.node);
    if (node)
      next = setNodeProp(
        next,
        source.node,
        "$connections",
        (node.$connections ?? []).filter(
          (connection) =>
            !(
              connection.target === use.target &&
              connection.sourceProperty === source.property &&
              connection.targetProperty === use.property
            ),
        ),
      );
  }
  const ports = new Map<
    string,
    Map<string, { id: string; role: string; side: string }>
  >();
  const addPort = (address: string, id: string, role: string, side: string) => {
    const entries = ports.get(address) ?? new Map();
    entries.set(id, { id, role, side });
    ports.set(address, entries);
  };
  for (const use of uses) {
    const source = sourceFor(use, state, bindings);
    const node = getNode(next, source.node);
    if (!node || !getNode(next, use.target)) continue;
    const targetProperty = use.property;
    addPort(source.node, source.property, "source", outputSide);
    const id = edgeKey(use);
    if (
      !previousKeys.has(id) &&
      !(node.$connections ?? []).some(
        (connection) =>
          connection.target === use.target &&
          connection.sourceProperty === source.property &&
          connection.targetProperty === targetProperty,
      )
    )
      next = setNodeProp(next, source.node, "$connections", [
        ...(node.$connections ?? []),
        {
          id,
          target: use.target,
          sourceProperty: source.property,
          targetProperty,
          style: "dashed",
        },
      ]);
  }
  for (const detached of previous?.disconnected ?? []) {
    const source = sourceFor(
      { ...detached, target: "", property: "", row: false },
      state,
      bindings,
    );
    if (!source.runtime && getNode(next, source.node))
      addPort(source.node, source.property, "source", outputSide);
  }
  for (const [address, entries] of ports) {
    const node = getNode(next, address);
    const ids = new Set(entries.keys());
    const custom = (node.$ports ?? []).filter(
      (port) => !port.id.startsWith("template:") && !ids.has(port.id),
    );
    const generated = [...entries.values()].map((port, index, all) => ({
      ...port,
      position: (index + 1) / (all.length + 1),
    }));
    next = setNodeProp(next, address, "$ports", [...custom, ...generated]);
  }
  for (const address of previousRoots) {
    if (!roots.has(address)) next = removeNode(next, address);
  }
  for (const use of previous?.uses ?? []) {
    const source = sourceFor(use, state, bindings);
    const node = getNode(next, source.node);
    if (
      !source.runtime &&
      node &&
      !ports.get(source.node)?.has(source.property)
    )
      next = setNodeProp(
        next,
        source.node,
        "$ports",
        (node.$ports ?? []).filter((port) => port.id !== source.property),
      );
  }
  if (!roots.size && previousRoots.size)
    next = removeNode(next, "root.templateVariables");
  return {
    view: next,
    graph: {
      uses,
      direction,
      ...(previous?.disconnected
        ? { disconnected: previous.disconnected }
        : {}),
    },
  };
}

export async function editTemplateConnections(
  view: SqueedJson,
  previousView: SqueedJson,
  state: SqueedJson,
  bindings: Record<string, StateFormBinding>,
  graph: TemplateGraph,
  schema?: FormSchema,
) {
  const ts = await import("typescript");
  const records = (document: SqueedJson) =>
    Object.entries(document).flatMap(([key, node]) =>
      (node && typeof node === "object" && Array.isArray(node.$connections)
        ? node.$connections
        : []
      ).map((connection) => ({ source: `root.${key}`, connection })),
    );
  const identity = (record: ReturnType<typeof records>[number]) =>
    JSON.stringify([
      record.source,
      record.connection.target,
      record.connection.sourceProperty,
      record.connection.targetProperty,
    ]);
  const previous = records(previousView),
    next = records(view);
  const previousIds = new Set(previous.map(identity)),
    nextIds = new Set(next.map(identity));
  let nextState = state;
  let disconnected = [...(graph.disconnected ?? [])];
  const rewrite = (text: string, path: string, replacement?: string): string =>
    text.replace(/\{\{([\s\S]*?)\}\}/g, (whole, expression: string) => {
      const source = ts.createSourceFile(
        "binding.ts",
        `(${expression})`,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      const statement = source.statements[0];
      if (!statement || !ts.isExpressionStatement(statement)) return whole;
      const matches = (node: TypeScript.Expression) => {
        const sourceText = node.getText(source);
        return (
          sourceText === path ||
          sourceText.replace(/\[['"]([A-Za-z_$][\w$]*)['"]\]/g, ".$1") === path
        );
      };
      const changes: { start: number; end: number; value: string }[] = [];
      const replacePath = (node: TypeScript.Node) => {
        if (
          ts.isPropertyAccessExpression(node) ||
          ts.isElementAccessExpression(node)
        ) {
          if (matches(node)) {
            changes.push({
              start: node.getStart(source) - 1,
              end: node.end - 1,
              value: replacement!,
            });
            return;
          }
        }
        ts.forEachChild(node, replacePath);
      };
      if (replacement !== undefined) {
        replacePath(statement.expression);
        if (!changes.length) return whole;
        let rewritten = expression;
        for (const change of changes.sort(
          (first, second) => second.start - first.start,
        ))
          rewritten =
            rewritten.slice(0, change.start) +
            change.value +
            rewritten.slice(change.end);
        return `{{${rewritten}}}`;
      }
      const remove = (node: TypeScript.Expression): string | undefined => {
        if (matches(node)) return undefined;
        if (ts.isParenthesizedExpression(node)) {
          const inner = remove(node.expression);
          return inner === undefined ? undefined : `(${inner})`;
        }
        if (
          ts.isBinaryExpression(node) &&
          [
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(node.operatorToken.kind)
        ) {
          const left = remove(node.left),
            right = remove(node.right);
          return left === undefined
            ? right
            : right === undefined
              ? left
              : `${left} ${node.operatorToken.getText(source)} ${right}`;
        }
        changes.length = 0;
        replacePath(node);
        if (changes.length)
          throw new Error(
            "Edit this compound expression in its form before disconnecting its source.",
          );
        return node.getText(source);
      };
      changes.length = 0;
      replacePath(statement.expression);
      if (!changes.length) return whole;
      const root = ts.isParenthesizedExpression(statement.expression)
        ? statement.expression.expression
        : statement.expression;
      const remaining = remove(root);
      return remaining === undefined ? "" : `{{${remaining}}}`;
    });
  for (const record of previous.filter(
    (entry) => !nextIds.has(identity(entry)),
  )) {
    for (const use of graph.uses) {
      const source = sourceFor(use, state, bindings);
      if (
        record.source !== source.node ||
        record.connection.sourceProperty !== source.property ||
        record.connection.target !== use.target ||
        record.connection.targetProperty !== use.property
      )
        continue;
      const before = getNode(nextState, use.address);
      if (typeof before !== "string") continue;
      const after = rewrite(before, use.path);
      if (after === before) continue;
      nextState = applyStateEdits(nextState, [
        { op: "set", address: use.address, value: after },
      ]);
      disconnected.push({
        address: use.address,
        before,
        after,
        path: use.path,
      });
    }
  }
  for (const record of next.filter(
    (entry) => !previousIds.has(identity(entry)),
  )) {
    const property = record.connection.sourceProperty as string | undefined;
    const targetProperty = record.connection.targetProperty as
      | string
      | undefined;
    if (!property || !targetProperty) continue;
    let path: string | undefined;
    if (record.source.startsWith("root.template_"))
      path = `${decodeURIComponent(record.source.slice("root.template_".length))}.${property}`;
    else if (property.startsWith("template:")) {
      const binding = bindings[record.source];
      const step =
        binding && getNode(state, binding.address.replace(/\.config$/, ""));
      if (step?.id)
        path = `steps.${step.id}.${property.slice("template:".length)}`;
    }
    if (!path || !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\.\d+)+$/.test(path))
      continue;
    const binding = bindings[record.connection.target];
    const targetAddress = binding?.schemaType
      ? `${binding.address}.value${targetProperty === "value" ? "" : `.${targetProperty}`}`
      : binding
        ? `${binding.address}.${targetProperty}`
        : undefined;
    if (!targetAddress || targetProperty.includes(":")) continue;
    const current = getNode(nextState, targetAddress);
    if (current !== undefined && typeof current !== "string")
      throw new Error("Connect a template source to a string property row.");
    const detached = [...disconnected]
      .reverse()
      .find(
        (entry) => entry.address === targetAddress && entry.after === current,
      );
    const value = detached
      ? rewrite(detached.before, detached.path, path)
      : `{{${path}}}`;
    nextState = applyStateEdits(nextState, [
      { op: "set", address: targetAddress, value },
    ]);
    disconnected = disconnected.filter((entry) => entry !== detached);
  }
  const uses = await readTemplateUses(
    nextState,
    view,
    Object.fromEntries(
      Object.entries(bindings).filter(([, binding]) => !binding.schemaType),
    ),
    schema,
  );
  const synchronized = syncTemplateGraph(
    view,
    nextState,
    bindings,
    uses,
    graph.direction,
    { ...graph, disconnected },
  );
  return {
    state: nextState,
    view: synchronized.view,
    templateGraph: synchronized.graph,
  };
}
