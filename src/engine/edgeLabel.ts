import { EDGE_LABEL_FONT_FAMILY, measureText, wrapText } from "./text";

export const LABEL_FONT_SIZE = 45;
export const LABEL_PADDING = 15;
export const LABEL_MARGIN_X = 50;
const LABEL_FONT = `${LABEL_FONT_SIZE}px ${EDGE_LABEL_FONT_FAMILY}`;

export function measureEdgeLabel(label?: string, icon?: string) {
  const lines = label ? wrapText(label, LABEL_FONT, 200) : [];
  const iconWidth = icon ? 48 + (lines.length ? 12 : 0) : 0;
  const contentWidth = iconWidth + Math.max(0, ...lines.map(line => measureText(line, LABEL_FONT)));
  const contentHeight = Math.max(lines.length * LABEL_FONT_SIZE, icon ? 48 : 0);
  const padding = lines.length || icon ? 2 * LABEL_PADDING : 0;
  return { lines, iconWidth, contentWidth, contentHeight, width: contentWidth + padding, height: contentHeight + padding };
}