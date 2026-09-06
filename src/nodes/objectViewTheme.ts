import { contentObjTheme, getChakraColorHex } from "../theme/colorUtils";
import { useThemeContentColors } from "../theme/useCustomColors";

export const getColorVars = (data, themeColor, colorMode) => {
  const bg = data?.viewProps?.bgColor || themeColor;
  const [wordBeforeDot] = bg.split(".");
  const colors = useThemeContentColors(bg);
  const outline = data?.viewProps?.outline === true;
  const isTransparent = bg === "transparent" || outline;
  const canvasText = colorMode === "dark" ? "gray.200" : "gray.900";

  const hexbgColor = isTransparent
    ? "transparent"
    : bg?.startsWith("#")
      ? getChakraColorHex(bg)
      : getChakraColorHex(colors.bgColor);
  const hextextColor = getChakraColorHex(
    data?.viewProps?.textColor ||
      (isTransparent ? canvasText : colors.textColor),
  );
  const hexborderColor = getChakraColorHex(
    data?.viewProps?.borderColor ||
      (outline ? (bg === "transparent" ? themeColor : bg) : colors.borderColor),
  );

  return {
    ...colors,
    bgColor: isTransparent ? "transparent" : colors.bgColor,
    highlightColor: isTransparent ? "transparent" : colors.highlightColor,
    isTransparent,
    propertyColor: isTransparent ? canvasText : colors.propertyColor,
    bg,
    wordBeforeDot,
    hexbgColor,
    hextextColor,
    hexborderColor,
  };
};

export const truncateText = (value, maxLength = 350) =>
  `${String(value).substring(0, maxLength)}${String(value).length > maxLength ? "..." : ""}`;

export const formatHeaderTitle = (title) =>
  title?.includes("root") ? title.replace("root", "untitled") : title;

export const OBJECT_VALUE_WIDTH = 600;
export const OBJECT_BORDER_WIDTH = 3;

export const calculateUniformKeyWidth = (description) => {
  const longestKeyLength = Math.max(
    ...Object.keys(description || {}).map((key) => key.length),
    0,
  );
  const charWidth = 28;
  return Math.max(longestKeyLength * charWidth + 30, 200);
};

