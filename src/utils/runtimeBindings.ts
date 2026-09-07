export interface RuntimeReference {
  path: string;
  label: string;
}

export interface RuntimePart {
  kind: "text" | "reference" | "conditional";
  text: string;
  paths: string[];
  fallback?: string;
}

export interface RuntimeBindingValue {
  mode: "reference" | "condition" | "template" | "json";
  parts: RuntimePart[];
  comparison: string;
  fields: { key: string; parts: RuntimePart[] }[];
}

export const runtimePart = (
  kind: RuntimePart["kind"] = "reference",
): RuntimePart => ({ kind, text: "", paths: [""] });
const validPath = (path: string) =>
  /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*|\.\d+)+$/.test(path) &&
  !path
    .split(".")
    .some((key) => ["__proto__", "constructor", "prototype"].includes(key));

export function serializeRuntimeBinding(
  value: RuntimeBindingValue,
  references: readonly RuntimeReference[],
): string {
  const allowed = new Set(references.map((reference) => reference.path));
  const referenceText = (part: RuntimePart) => {
    if (
      !part.paths.length ||
      part.paths.some((path) => !validPath(path) || !allowed.has(path))
    )
      throw new Error("Choose an available reference.");
    return [
      ...part.paths,
      ...(part.fallback === undefined ? [] : [JSON.stringify(part.fallback)]),
    ].join(" || ");
  };
  const plainText = (text: string) => {
    if (text.includes("{{") || text.includes("}}"))
      throw new Error("Use a reference part for dynamic values.");
    return text;
  };
  const render = (parts: RuntimePart[]) =>
    parts
      .map((part) => {
        if (part.kind === "text") return plainText(part.text);
        if (part.kind === "conditional") {
          if (part.paths.length !== 1 || part.fallback !== undefined)
            throw new Error("Choose one condition reference.");
          return `{{#if ${referenceText(part)}}}${plainText(part.text)}{{/if}}`;
        }
        return `{{${referenceText(part)}}}`;
      })
      .join("");
  if (value.mode === "reference" || value.mode === "condition") {
    if (value.parts.length !== 1 || value.parts[0].kind !== "reference")
      throw new Error("Choose one reference binding.");
    const result = render(value.parts);
    return value.mode === "condition"
      ? `${result} == ${JSON.stringify(value.comparison)}`
      : result;
  }
  if (value.mode === "json") {
    const keys = value.fields.map((field) => field.key);
    if (
      !keys.length ||
      new Set(keys).size !== keys.length ||
      keys.some(
        (key) =>
          !key || ["__proto__", "constructor", "prototype"].includes(key),
      )
    )
      throw new Error("Output field names must be unique and nonempty.");
    return JSON.stringify(
      Object.fromEntries(
        value.fields.map((field) => [field.key, render(field.parts)]),
      ),
    );
  }
  return render(value.parts);
}

export async function parseRuntimeBinding(
  text: string,
): Promise<RuntimeBindingValue> {
  const ts = await import("typescript");
  const fallbackPart = (expression: string): RuntimePart => {
    const source = ts.createSourceFile(
      "binding.ts",
      `(${expression})`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    if (
      (source as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics
        .length
    )
      throw new Error("Unsupported reference expression.");
    const statement = source.statements[0];
    if (!statement || !ts.isExpressionStatement(statement))
      throw new Error("Unsupported reference expression.");
    const part = runtimePart();
    part.paths = [];
    const visit = (node: import("typescript").Expression) => {
      if (ts.isParenthesizedExpression(node)) return visit(node.expression);
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken
      ) {
        visit(node.left);
        visit(node.right);
        return;
      }
      if (ts.isStringLiteral(node)) {
        if (part.fallback !== undefined)
          throw new Error("Multiple fallback values.");
        part.fallback = node.text;
        return;
      }
      const path = node.getText(source);
      if (!validPath(path) || part.fallback !== undefined)
        throw new Error("Unsupported reference expression.");
      part.paths.push(path);
    };
    visit(statement.expression);
    if (!part.paths.length) throw new Error("A binding needs a reference.");
    return part;
  };
  const partsOf = (input: string): RuntimePart[] => {
    const parts: RuntimePart[] = [];
    let offset = 0;
    const tokens = /\{\{([\s\S]*?)\}\}/g;
    for (const match of input.matchAll(tokens)) {
      const index = match.index!;
      if (index < offset) continue;
      if (index > offset)
        parts.push({
          ...runtimePart("text"),
          text: input.slice(offset, index),
        });
      const expression = match[1].trim();
      if (expression.startsWith("#if ")) {
        const end = input.indexOf("{{/if}}", index + match[0].length);
        if (end < 0) throw new Error("Unclosed condition.");
        parts.push({
          ...fallbackPart(expression.slice(4)),
          kind: "conditional",
          text: input.slice(index + match[0].length, end),
        });
        offset = end + 7;
      } else {
        parts.push(fallbackPart(expression));
        offset = index + match[0].length;
      }
    }
    if (offset < input.length)
      parts.push({ ...runtimePart("text"), text: input.slice(offset) });
    return parts;
  };
  const base: RuntimeBindingValue = {
    mode: "reference",
    parts: [runtimePart()],
    comparison: "",
    fields: [],
  };
  if (!text) return base;
  if (text.trim().startsWith("{")) {
    try {
      const object = JSON.parse(text);
      if (
        object &&
        typeof object === "object" &&
        !Array.isArray(object) &&
        Object.values(object).every((value) => typeof value === "string")
      )
        return {
          ...base,
          mode: "json",
          fields: Object.entries(object).map(([key, value]) => ({
            key,
            parts: partsOf(value as string),
          })),
        };
    } catch {}
  }
  const parts = partsOf(text);
  if (
    parts.length === 2 &&
    parts[0].kind === "reference" &&
    parts[1].kind === "text"
  ) {
    const source = ts.createSourceFile(
      "condition.ts",
      `value ${parts[1].text}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const statement = source.statements[0];
    if (
      source.statements.length === 1 &&
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind ===
        ts.SyntaxKind.EqualsEqualsToken &&
      ts.isStringLiteral(statement.expression.right)
    )
      return {
        ...base,
        mode: "condition",
        parts: [parts[0]],
        comparison: statement.expression.right.text,
      };
  }
  return {
    ...base,
    mode:
      parts.length === 1 && parts[0].kind === "reference"
        ? "reference"
        : "template",
    parts,
  };
}
