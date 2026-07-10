import { useColorModeValue } from "@chakra-ui/react";
import { contentObjTheme, getColorVariant, getChakraColorHex } from "./colorUtils";

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

  bgColorFaint = getChakraColorHex(bgColorFaint) + 50;
  highlightColorFaint = getChakraColorHex(highlightColorFaint) + 20;

  return { bgColor, highlightColor, borderColor, textColor, propertyColor, secondary, bgColorFaint, highlightColorFaint };
}

export function useCustomColors(theme = null) {
  const isDark = theme?.includes("gray");

  const background = useColorModeValue("gray.100", "gray.900");
  const backgroundSecondary = useColorModeValue("gray.200", "blackAlpha.400");
  const darkBackgroundSecondary = useColorModeValue("gray.200", "blackAlpha.600");

  const border = useColorModeValue("gray.500", "gray.800");
  const borderSecondary = useColorModeValue("gray.700", "gray.700");

  const darkColor = useColorModeValue("gray.900", "gray.900");

  const colorActive = useColorModeValue("gray.400", "gray.500");
  const colorInactive = useColorModeValue("gray.400", "gray.700");
  const colorText = useColorModeValue("gray.900", "gray.200");
  const themedColorText = useColorModeValue(isDark ? "gray.900" : "gray.200", isDark ? "gray.200" : "gray.900");

  const iconColor = useColorModeValue("gray.900", "gray.200");
  const logoColor = useColorModeValue(!theme ? theme : "#000000", !!theme ? theme : "#ffffff");
  const logoColorSecondary = useColorModeValue(!!theme ? theme : "#ffffff", !theme ? "#ffffff" : "#000000");

  const moreIconColor = borderSecondary;

  const darkColorActive = useColorModeValue("gray.300", "gray.800");
  const backgroundWhiteColor = useColorModeValue("white", "blackAlpha.400");
  const greenColor = useColorModeValue("green.100", "green.700");

  return {
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
