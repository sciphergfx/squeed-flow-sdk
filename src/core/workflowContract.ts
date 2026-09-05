import type { FlowDiagramEdge } from "../types";

export type ContractType =
  | { kind: "string" | "number" | "integer" | "boolean" | "null" }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "union"; types: ContractType[] }
  | { kind: "array"; items: ContractType }
  | { kind: "object"; properties: Record<string, ContractProperty> };
export interface ContractProperty {
  type: ContractType;
  optional: boolean;
}
export interface WorkflowContract {
  name: string;
  nodes: Record<string, ContractProperty>;
}

export function parseJsonContract(
  source: string,
  name: string,
): WorkflowContract {
  const root = JSON.parse(source);
  let remaining = 512;
  const parse = (schema: any, trail: string[] = []): ContractType => {
    if (--remaining < 0)
      throw new Error("Interface exceeds the 512-type expansion limit.");
    if (!schema || typeof schema !== "object" || Array.isArray(schema))
      throw new Error("Expected a JSON Schema object.");
    const allowed = new Set([
      "$schema",
      "$id",
      "$defs",
      "definitions",
      "$ref",
      "title",
      "description",
      "default",
      "examples",
      "type",
      "properties",
      "required",
      "items",
      "enum",
      "const",
      "anyOf",
      "additionalProperties",
    ]);
    for (const key of Object.keys(schema))
      if (!allowed.has(key))
        throw new Error(`Unsupported JSON Schema keyword: ${key}`);
    const annotations = [
      "$schema",
      "$id",
      "$defs",
      "definitions",
      "title",
      "description",
      "default",
      "examples",
    ];
    if (schema.$ref) {
      if (
        Object.keys(schema).some(
          (key) => !["$ref", "title", "description"].includes(key),
        )
      )
        throw new Error("Use $ref without sibling constraints.");
      if (
        typeof schema.$ref !== "string" ||
        !schema.$ref.startsWith("#/") ||
        trail.includes(schema.$ref)
      )
        throw new Error(
          "Only nonrecursive local $ref references are supported.",
        );
      let resolved = root;
      for (const part of schema.$ref.slice(2).split("/")) {
        const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
        if (!resolved || !Object.prototype.hasOwnProperty.call(resolved, key))
          throw new Error(`Unresolved reference: ${schema.$ref}`);
        resolved = resolved[key];
      }
      return parse(resolved, [...trail, schema.$ref]);
    }
    if (schema.anyOf) {
      if (
        !Array.isArray(schema.anyOf) ||
        !schema.anyOf.length ||
        Object.keys(schema).some(
          (key) => key !== "anyOf" && !annotations.includes(key),
        )
      )
        throw new Error(
          "Use a nonempty anyOf without sibling type constraints.",
        );
      return {
        kind: "union",
        types: schema.anyOf.map((item: any) => parse(item, trail)),
      };
    }
    if (Object.prototype.hasOwnProperty.call(schema, "const") || schema.enum) {
      if (
        Object.keys(schema).some(
          (key) => ![...annotations, "const", "enum", "type"].includes(key),
        ) ||
        (schema.enum && Object.prototype.hasOwnProperty.call(schema, "const"))
      )
        throw new Error(
          "Use enum or const without sibling constraints other than type.",
        );
      const values = Object.prototype.hasOwnProperty.call(schema, "const")
        ? [schema.const]
        : schema.enum;
      if (!Array.isArray(values) || !values.length)
        throw new Error("Expected a nonempty enum.");
      const types: ContractType[] = values.map((value) => {
        if (
          value !== null &&
          !["string", "number", "boolean"].includes(typeof value)
        )
          throw new Error("Only primitive literals are supported.");
        const actual = value === null ? "null" : typeof value;
        if (
          schema.type &&
          !(Array.isArray(schema.type) ? schema.type : [schema.type]).some(
            (type: string) =>
              type === actual ||
              (type === "integer" && Number.isInteger(value)),
          )
        )
          throw new Error("Literal does not match its declared type.");
        return { kind: "literal", value };
      });
      return { kind: "union", types };
    }
    if (Array.isArray(schema.type)) {
      if (
        !schema.type.length ||
        schema.type.some((type: unknown) => typeof type !== "string")
      )
        throw new Error("Expected a nonempty list of primitive types.");
      if (
        Object.keys(schema).some(
          (key) => key !== "type" && !annotations.includes(key),
        )
      )
        throw new Error(
          "Use anyOf for unions with object or array constraints.",
        );
      return {
        kind: "union",
        types: schema.type.map((type: string) => parse({ type }, trail)),
      };
    }
    if (
      (schema.properties ||
        schema.required ||
        schema.additionalProperties !== undefined) &&
      schema.type !== "object" &&
      schema.type !== undefined
    )
      throw new Error("Object constraints require an object type.");
    if (schema.items && schema.type !== "array")
      throw new Error("items requires an array type.");
    if (schema.type === "object" || schema.properties) {
      if (
        schema.additionalProperties !== undefined &&
        schema.additionalProperties !== true
      )
        throw new Error(
          "Closed objects and typed additionalProperties are not supported.",
        );
      if (
        !schema.properties ||
        typeof schema.properties !== "object" ||
        Array.isArray(schema.properties)
      )
        throw new Error("Object schemas must declare properties.");
      if (
        schema.required !== undefined &&
        (!Array.isArray(schema.required) ||
          schema.required.some(
            (key: unknown) =>
              typeof key !== "string" ||
              !Object.prototype.hasOwnProperty.call(schema.properties, key),
          ))
      )
        throw new Error("required must list declared property names.");
      const properties = Object.fromEntries(
        Object.entries(schema.properties).map(([key, value]) => [
          key,
          {
            type: parse(value, trail),
            optional: !(schema.required ?? []).includes(key),
          },
        ]),
      );
      return { kind: "object", properties };
    }
    if (schema.type === "array")
      return { kind: "array", items: parse(schema.items, trail) };
    if (
      ["string", "number", "integer", "boolean", "null"].includes(schema.type)
    )
      return { kind: schema.type };
    throw new Error("Every property must declare a supported type.");
  };
  const contract = parse(root);
  if (contract.kind !== "object")
    throw new Error("The root schema must be an object keyed by node ID.");
  if (
    Object.values(contract.properties).some(
      (property) => property.type.kind !== "object",
    )
  )
    throw new Error("Each node must declare an object of property types.");
  return { name, nodes: contract.properties };
}

export async function parseTypeScriptForm(
  source: string,
  name: string,
  typeName?: string,
): Promise<Extract<ContractType, { kind: "object" }>> {
  let remaining = 512;
  const ts = await import("typescript");
  const file = ts.createSourceFile(
    name,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics = (
    file as typeof file & {
      parseDiagnostics?: readonly { messageText: unknown }[];
    }
  ).parseDiagnostics;
  if (diagnostics?.length) throw new Error("Invalid TypeScript syntax.");
  const declarations = new Map<
    string,
    | import("typescript").InterfaceDeclaration
    | import("typescript").TypeAliasDeclaration
  >();
  for (const statement of file.statements) {
    if (
      !ts.isInterfaceDeclaration(statement) &&
      !ts.isTypeAliasDeclaration(statement)
    )
      throw new Error(
        "Upload interfaces/type aliases only; imports and executable code are not supported.",
      );
    if (
      statement.typeParameters?.length ||
      declarations.has(statement.name.text)
    )
      throw new Error("Generics and duplicate declarations are not supported.");
    declarations.set(statement.name.text, statement);
  }
  const parseMembers = (
    members: import("typescript").NodeArray<import("typescript").TypeElement>,
    trail: string[],
  ): ContractType => ({
    kind: "object",
    properties: Object.fromEntries(
      members.map((member) => {
        if (
          !ts.isPropertySignature(member) ||
          !member.type ||
          !member.name ||
          (!ts.isIdentifier(member.name) && !ts.isStringLiteral(member.name))
        )
          throw new Error(
            "Only explicitly typed named properties are supported.",
          );
        return [
          member.name.text,
          { type: parse(member.type, trail), optional: !!member.questionToken },
        ];
      }),
    ),
  });
  const resolve = (key: string, trail: string[]): ContractType => {
    if (trail.includes(key))
      throw new Error("Recursive types are not supported.");
    const declaration = declarations.get(key);
    if (!declaration) throw new Error(`Unknown type: ${key}`);
    if (ts.isInterfaceDeclaration(declaration)) {
      if (declaration.heritageClauses?.length)
        throw new Error(
          "Interface inheritance is not supported; declare properties explicitly.",
        );
      return parseMembers(declaration.members, [...trail, key]);
    }
    return parse(declaration.type, [...trail, key]);
  };
  const parse = (
    node: import("typescript").TypeNode,
    trail: string[],
  ): ContractType => {
    if (--remaining < 0)
      throw new Error("Interface exceeds the 512-type expansion limit.");
    if (node.kind === ts.SyntaxKind.StringKeyword) return { kind: "string" };
    if (node.kind === ts.SyntaxKind.NumberKeyword) return { kind: "number" };
    if (node.kind === ts.SyntaxKind.BooleanKeyword) return { kind: "boolean" };
    if (ts.isParenthesizedTypeNode(node)) return parse(node.type, trail);
    if (ts.isUnionTypeNode(node))
      return {
        kind: "union",
        types: node.types.map((type) => parse(type, trail)),
      };
    if (ts.isArrayTypeNode(node))
      return { kind: "array", items: parse(node.elementType, trail) };
    if (ts.isTypeLiteralNode(node)) return parseMembers(node.members, trail);
    if (ts.isLiteralTypeNode(node)) {
      const literal = node.literal;
      if (ts.isStringLiteral(literal))
        return { kind: "literal", value: literal.text };
      if (ts.isNumericLiteral(literal))
        return { kind: "literal", value: Number(literal.text) };
      if (literal.kind === ts.SyntaxKind.NullKeyword) return { kind: "null" };
      if (
        literal.kind === ts.SyntaxKind.TrueKeyword ||
        literal.kind === ts.SyntaxKind.FalseKeyword
      )
        return {
          kind: "literal",
          value: literal.kind === ts.SyntaxKind.TrueKeyword,
        };
    }
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      if (node.typeName.text === "Array" && node.typeArguments?.length === 1)
        return { kind: "array", items: parse(node.typeArguments[0], trail) };
      if (!node.typeArguments?.length)
        return resolve(node.typeName.text, trail);
    }
    throw new Error(`Unsupported TypeScript type: ${node.getText(file)}`);
  };
  const root =
    typeName ??
    (declarations.has("Graph")
      ? "Graph"
      : declarations.size === 1
        ? [...declarations.keys()][0]
        : undefined);
  if (!root) throw new Error("Declare an interface Graph keyed by node ID.");
  const contract = resolve(root, []);
  if (contract.kind !== "object")
    throw new Error("Graph must be an object keyed by node ID.");
  return contract;
}

export async function parseTypeScriptContract(
  source: string,
  name: string,
): Promise<WorkflowContract> {
  const contract = await parseTypeScriptForm(source, name);
  if (
    Object.values(contract.properties).some(
      (property) => property.type.kind !== "object",
    )
  )
    throw new Error("Each node must declare an object of property types.");
  return { name, nodes: contract.properties };
}

export function isAssignable(
  source: ContractType,
  target: ContractType,
): boolean {
  if (source.kind === "union")
    return source.types.every((type) => isAssignable(type, target));
  if (target.kind === "union")
    return target.types.some((type) => isAssignable(source, type));
  if (source.kind === "literal") {
    if (target.kind === "literal") return source.value === target.value;
    const kind = source.value === null ? "null" : typeof source.value;
    return (
      target.kind === kind ||
      (target.kind === "integer" &&
        typeof source.value === "number" &&
        Number.isInteger(source.value))
    );
  }
  if (source.kind === "integer" && target.kind === "number") return true;
  if (source.kind === "array" && target.kind === "array")
    return isAssignable(source.items, target.items);
  if (source.kind === "object" && target.kind === "object")
    return Object.entries(target.properties).every(([key, property]) => {
      const provided = Object.prototype.hasOwnProperty.call(
        source.properties,
        key,
      )
        ? source.properties[key]
        : undefined;
      return provided
        ? (property.optional || !provided.optional) &&
            isAssignable(provided.type, property.type)
        : property.optional;
    });
  return source.kind === target.kind;
}

export function connectionIssue(
  contract: WorkflowContract,
  edge: FlowDiagramEdge["data"],
): string | undefined {
  if (!edge.sourceProperty && !edge.targetProperty) return;
  const property = (
    id: string,
    key: string | undefined,
  ): ContractProperty | undefined => {
    const address = Object.prototype.hasOwnProperty.call(contract.nodes, id)
      ? id
      : id.replace(/^root\./, "");
    const node = Object.prototype.hasOwnProperty.call(contract.nodes, address)
      ? contract.nodes[address]?.type
      : undefined;
    return key &&
      node?.kind === "object" &&
      Object.prototype.hasOwnProperty.call(node.properties, key)
      ? node.properties[key]
      : undefined;
  };
  const source = property(edge.source, edge.sourceProperty);
  const target = property(edge.target, edge.targetProperty);
  if (!source || !target)
    return "Unverified: source or target property is missing from the interface.";
  if (source.optional && !target.optional)
    return "Optional source cannot supply a required target property.";
  if (!isAssignable(source.type, target.type))
    return `Incompatible property types: ${edge.sourceProperty} -> ${edge.targetProperty}.`;
}

export async function readWorkflowContract(
  file: File,
): Promise<WorkflowContract> {
  if (file.size > 256 * 1024)
    throw new Error("Interface must be 256 KB or smaller.");
  const source = await file.text();
  if (/\.json$/i.test(file.name)) return parseJsonContract(source, file.name);
  if (/\.ts$/i.test(file.name))
    return parseTypeScriptContract(source, file.name);
  throw new Error("Choose a .ts interface or .json JSON Schema file.");
}
