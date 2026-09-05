// cytoscape's canvas label defaults; the SDK never overrode font family
export const EDGE_LABEL_FONT_FAMILY = '"Helvetica Neue", Helvetica, sans-serif';

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

export function measureText(text: string, font: string): number {
  const key = `${font}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (ctx === undefined) {
    ctx =
      typeof document !== "undefined"
        ? document.createElement("canvas").getContext("2d")
        : null;
  }
  let w: number;
  if (ctx) {
    ctx.font = font;
    w = ctx.measureText(text).width;
  } else {
    w = text.length * (parseFloat(font) || 16) * 0.55;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(key, w);
  return w;
}

/** cytoscape `text-wrap: wrap` with `text-overflow-wrap: whitespace`: break at spaces only */
export function wrapText(
  text: string,
  font: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const para of String(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (!line || measureText(cand, font) <= maxWidth) line = cand;
      else {
        lines.push(line);
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}
