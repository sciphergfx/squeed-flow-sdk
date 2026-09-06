import type { SqueedJson } from "./squeedEdits";

export function projectJsonPlaybackPreview(
  partial: SqueedJson,
  document: SqueedJson,
): SqueedJson {
  const visit = (value: any, original: any): any => {
    if (value === null || typeof value !== "object")
      return typeof value === typeof original ? value : undefined;
    if (!original || typeof original !== "object") return undefined;
    if (Array.isArray(value))
      return Array.isArray(original)
        ? value
            .map((child, index) => visit(child, original[index]))
            .filter((child) => child !== undefined)
        : undefined;
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, child]) => {
        if (!Object.prototype.hasOwnProperty.call(original, key)) return [];
        if (key.startsWith("$") && key !== "$")
          return JSON.stringify(child) === JSON.stringify(original[key])
            ? [[key, child]]
            : [];
        const next = visit(child, original[key]);
        return next === undefined ? [] : [[key, next]];
      }),
    );
  };
  return visit(partial, document) ?? {};
}
