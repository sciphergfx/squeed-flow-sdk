import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import {
  contentObjTheme,
  getChakraColorHex,
  getColorVariant,
} from "./colorUtils";

function colorModeValue<T>(isDark: boolean, light: T, dark: T): T {
  return isDark ? dark : light;
}

export function useThemeContentColors(color: any) {
  const [wordBeforeDot] = color?.split(".") || [];
  const { secondary } = getColorVariant(color);

  const bgColor = contentObjTheme(wordBeforeDot)["background"];
  const highlightColor = contentObjTheme(wordBeforeDot)["highlight"];
  const borderColor = contentObjTheme(wordBeforeDot)["border"];
  const textColor = contentObjTheme(wordBeforeDot)["property"];
  const propertyColor = contentObjTheme(wordBeforeDot)["property"];

  let bgColorFaint = contentObjTheme(wordBeforeDot)["background"];
  let highlightColorFaint = contentObjTheme(wordBeforeDot)["highlight"];

  bgColorFaint =
    color === "transparent" ? color : getChakraColorHex(bgColorFaint) + 50;
  highlightColorFaint =
    color === "transparent"
      ? color
      : getChakraColorHex(highlightColorFaint) + 20;

  return {
    bgColor,
    highlightColor,
    borderColor,
    textColor,
    propertyColor,
    secondary,
    bgColorFaint,
    highlightColorFaint,
  };
}

export function useCustomColors(theme = null) {
  const { colorMode } = useFlowDiagramContext();
  const isDark = theme?.includes("gray");
  const darkMode = colorMode === "dark";

  // canvas = diagram backdrop (also masks edge labels); background = elevated surfaces
  const canvas = colorModeValue(darkMode, "white", "gray.900");
  const background = colorModeValue(darkMode, "gray.100", "gray.800");
  const backgroundSecondary = colorModeValue(
    darkMode,
    "gray.200",
    "blackAlpha.400",
  );
  const darkBackgroundSecondary = colorModeValue(
    darkMode,
    "gray.200",
    "blackAlpha.600",
  );

  const border = colorModeValue(darkMode, "gray.500", "gray.700");
  const borderSecondary = colorModeValue(darkMode, "gray.700", "gray.700");

  const darkColor = colorModeValue(darkMode, "gray.900", "gray.900");

  const colorActive = colorModeValue(darkMode, "gray.400", "gray.500");
  const colorInactive = colorModeValue(darkMode, "gray.400", "gray.500");
  const colorText = colorModeValue(darkMode, "gray.900", "gray.200");
  const themedColorText = colorModeValue(
    darkMode,
    isDark ? "gray.900" : "gray.200",
    isDark ? "gray.200" : "gray.900",
  );

  const iconColor = colorModeValue(darkMode, "gray.900", "gray.200");
  const logoColor = colorModeValue(
    darkMode,
    !theme ? theme : "#000000",
    !!theme ? theme : "#ffffff",
  );
  const logoColorSecondary = colorModeValue(
    darkMode,
    !!theme ? theme : "#ffffff",
    !theme ? "#ffffff" : "#000000",
  );

  const moreIconColor = borderSecondary;

  const darkColorActive = colorModeValue(darkMode, "gray.300", "gray.800");
  const backgroundWhiteColor = colorModeValue(
    darkMode,
    "white",
    "blackAlpha.400",
  );
  const greenColor = colorModeValue(darkMode, "green.100", "green.700");

  return {
    canvas,
    background,
    backgroundSecondary,
    darkBackgroundSecondary,
    border,
    darkColor,
    backgroundWhiteColor,
    borderSecondary,
    colorActive,
    colorInactive,
    iconColor,
    moreIconColor,
    colorText,
    themedColorText,
    logoColor,
    logoColorSecondary,
    darkColorActive,
    greenColor,
  };
}
