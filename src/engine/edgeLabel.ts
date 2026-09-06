import { EDGE_LABEL_FONT_FAMILY, measureText, wrapText } from "./text";

export const LABEL_FONT_SIZE = 45;
export const NODE_LABEL_FONT_SIZE = 70;
export const LABEL_PADDING = 15;
export const LABEL_MARGIN_X = 50;
export function measureEdgeLabel(label?: string, icon?: string, fontSize = LABEL_FONT_SIZE) {
  const font = `${fontSize}px ${EDGE_LABEL_FONT_FAMILY}`;
  const lines = label ? wrapText(label, font, 200 * fontSize / LABEL_FONT_SIZE) : [];
  const iconWidth = icon ? 48 + (lines.length ? 12 : 0) : 0;
  const contentWidth =
    iconWidth +
    Math.max(0, ...lines.map((line) => measureText(line, font)));
  const contentHeight = Math.max(lines.length * fontSize, icon ? 48 : 0);
  const padding = lines.length || icon ? 2 * LABEL_PADDING : 0;
  return {
    lines,
    iconWidth,
    contentWidth,
    contentHeight,
    width: contentWidth + padding,
    height: contentHeight + padding,
  };
}
