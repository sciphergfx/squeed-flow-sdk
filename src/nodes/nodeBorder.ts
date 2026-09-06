import type { ParentNodeStyle } from "../types";
import { getInteractionShadow } from "../theme/interactionShadow";

export function getNodeBorderWidth(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

export function getNodeBorderProps(
  viewProps:
    | Pick<
        ParentNodeStyle,
        "outline" | "borderColor" | "borderWidth" | "borderStyle"
      >
    | undefined,
  color: string,
  isActive: boolean,
  defaultWidth: number,
) {
  return {
    borderColor: color,
    borderWidth: getNodeBorderWidth(viewProps?.borderWidth, defaultWidth),
    borderStyle: viewProps?.borderStyle ?? "solid",
    ...getInteractionShadow(color === "transparent" ? "currentColor" : color, isActive, ".flow-sdk-node:hover &", !isActive),
  };
}
