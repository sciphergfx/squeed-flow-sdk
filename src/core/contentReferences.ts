export interface ContentReference {
  $contentRef: string;
  path?: (string | number)[];
  prefix?: string;
  suffix?: string;
}

export function resolveContentReferences(
  content: unknown,
  readContent: (address: string) => unknown,
): unknown {
  let remaining = 100_000;
  const unsafe = new Set(["__proto__", "prototype", "constructor"]);
  const parsed = new Map<string, unknown>();
  const visit = (value: unknown, trail: string[], depth: number): unknown => {
    if (--remaining < 0 || depth > 100)
      throw new Error("Content references exceed the expansion limit.");
    if (!value || typeof value !== "object") return value;
    if (Object.prototype.hasOwnProperty.call(value, "$contentRef")) {
      const reference = value as ContentReference;
      const address = reference.$contentRef;
      const path = reference.path ?? [];
      if (
        typeof address !== "string" ||
        !/^root(?:\.[A-Za-z0-9_%~-]+)*$/.test(address) ||
        address.split(".").some((part) => unsafe.has(part)) ||
        !Array.isArray(path) ||
        path.some((part) =>
          typeof part === "number"
            ? !Number.isSafeInteger(part) || part < 0
            : typeof part !== "string" || unsafe.has(part),
        ) ||
        (reference.prefix !== undefined &&
          typeof reference.prefix !== "string") ||
        (reference.suffix !== undefined &&
          typeof reference.suffix !== "string") ||
        Object.keys(reference).some(
          (key) => !["$contentRef", "path", "prefix", "suffix"].includes(key),
        )
      )
        throw new Error("Invalid content reference.");
      const key = JSON.stringify([address, path]);
      if (trail.includes(key))
        throw new Error(`Circular content reference: ${address}.`);
      if (!parsed.has(address)) {
        const source = readContent(address);
        parsed.set(
          address,
          typeof source === "string" ? JSON.parse(source) : source,
        );
      }
      let resolved = parsed.get(address);
      for (const part of path) {
        resolved =
          resolved &&
          typeof resolved === "object" &&
          Object.prototype.hasOwnProperty.call(resolved, part)
            ? (resolved as Record<string | number, unknown>)[part]
            : undefined;
      }
      if (resolved === undefined)
        throw new Error(`Content reference not found: ${address}.`);
      const result = visit(resolved, [...trail, key], depth + 1);
      if (reference.prefix !== undefined || reference.suffix !== undefined) {
        if (typeof result !== "string")
          throw new Error("Content reference formatting requires a string.");
        return `${reference.prefix ?? ""}${result}${reference.suffix ?? ""}`;
      }
      return result;
    }
    if (Array.isArray(value)) {
      const next = value.map((child) => visit(child, trail, depth + 1));
      return next.some((child, index) => child !== value[index]) ? next : value;
    }
    const next = { ...value } as Record<string, unknown>;
    let changed = false;
    for (const [key, child] of Object.entries(value)) {
      if (unsafe.has(key)) throw new Error("Unsafe content property.");
      const resolved = visit(child, trail, depth + 1);
      next[key] = resolved;
      changed ||= resolved !== child;
    }
    return changed ? next : value;
  };
  // Empty content has no references to resolve; parsing it would surface
  // "Unexpected end of JSON input" before the content is written.
  const value =
    typeof content === "string"
      ? content.trim()
        ? JSON.parse(content)
        : content
      : content;
  const resolved = visit(value, [], 0);
  return resolved === value ? content : resolved;
}
