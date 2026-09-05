import type { ParentNodeStyle } from "../types";

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
  const styled =
    viewProps?.outline === true ||
    !!viewProps?.borderColor ||
    viewProps?.borderStyle !== undefined ||
    viewProps?.borderWidth !== undefined;
  return {
    borderColor: isActive && !styled ? "white" : color,
    borderWidth: getNodeBorderWidth(viewProps?.borderWidth, defaultWidth),
    borderStyle: viewProps?.borderStyle ?? "solid",
    outline: isActive && styled ? "3px solid white" : undefined,
    outlineOffset: "3px",
    _hover: { borderColor: styled ? color : "white" },
  };
}
