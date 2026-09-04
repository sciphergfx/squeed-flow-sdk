export function getDarkerHexColor(hex: string, factor: number = 0.2): string {
  const normalizedHex = hex.replace(/^#/, "");
  const num = parseInt(normalizedHex, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.floor(r * (1 - factor)));
  g = Math.max(0, Math.floor(g * (1 - factor)));
  b = Math.max(0, Math.floor(b * (1 - factor)));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/** Composite `overlay` at `alpha` over opaque `base`; null if either isn't #RRGGBB */
export function blendHexColors(base: string, overlay: string, alpha: number): string | null {
  const parse = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h?.trim() ?? "");
    return m ? parseInt(m[1], 16) : null;
  };
  const b = parse(base);
  const o = parse(overlay);
  if (b === null || o === null) return null;
  const ch = (shift: number) =>
    Math.round(((b >> shift) & 0xff) * (1 - alpha) + ((o >> shift) & 0xff) * alpha);
  return "#" + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1).toUpperCase();
}

export const contentObjTheme = (color) => {
  if (color?.startsWith("#")) {
    return {
      background: color,
      highlight: getDarkerHexColor(color, 0.1),
      border: getDarkerHexColor(color, 0.5),
      property: "gray.900",
      boolean: "green.200",
      string: "gray.900",
      number: "orange.800",
    };
  }

  if (color === "gray") {
    return {
      background: "gray.950",
      highlight: "gray.800",
      border: "gray.700",
      property: "gray.200",
      boolean: "green.400",
      string: "gray.200",
      number: "orange.600",
    };
  }
  if (color === "white") {
    return {
      background: "white",
      highlight: "gray.200",
      border: "gray.400",
      property: "gray.900",
      boolean: "green.400",
      string: "gray.900",
      number: "orange.600",
    };
  }

  return {
    background: color + ".100",
    highlight: color + ".200",
    border: color + ".700",
    property: "gray.900",
    boolean: "green.800",
    string: "gray.900",
    number: "orange.800",
  };
};

export const getColorVariant = (color: string) => {
  let primary = color;

  if (primary?.startsWith("#")) {
    return { secondary: getDarkerHexColor(color) };
  }

  let secondary = String(Number(color.slice(-3)) + 200);
  secondary = color.slice(0, -3).concat(secondary);

  let light = String(Number(color.slice(-3)) - 100);
  light = color.slice(0, -3).concat(light);

  return { primary, secondary, light };
};

const CHAKRA_COLOR_MAP: Record<string, Record<number, string>> = {
  red: { 50: "#FFF5F5", 100: "#FED7D7", 200: "#FEB2B2", 300: "#FC8181", 400: "#F56565", 500: "#E53E3E", 600: "#C53030", 700: "#9B2C2C", 800: "#822727", 900: "#63171B" },
  orange: { 50: "#FFFAF0", 100: "#FEEBC8", 200: "#FBD38D", 300: "#F6AD55", 400: "#ED8936", 500: "#DD6B20", 600: "#C05621", 700: "#9C4221", 800: "#7B341E", 900: "#652B19" },
  yellow: { 50: "#FFFFF0", 100: "#FEFCBF", 200: "#FAF089", 300: "#F6E05E", 400: "#ECC94B", 500: "#D69E2E", 600: "#B7791F", 700: "#975A16", 800: "#744210", 900: "#5F370E" },
  green: { 50: "#F0FFF4", 100: "#C6F6D5", 200: "#9AE6B4", 300: "#68D391", 400: "#48BB78", 500: "#38A169", 600: "#2F855A", 700: "#276749", 800: "#22543D", 900: "#1C4532" },
  teal: { 50: "#E6FFFA", 100: "#B2F5EA", 200: "#81E6D9", 300: "#4FD1C5", 400: "#38B2AC", 500: "#319795", 600: "#2C7A7B", 700: "#285E61", 800: "#234E52", 900: "#1D4044" },
  blue: { 50: "#EBF8FF", 100: "#BEE3F8", 200: "#90CDF4", 300: "#63B3ED", 400: "#4299E1", 500: "#3182CE", 600: "#2B6CB0", 700: "#2C5282", 800: "#2A4365", 900: "#1A365D" },
  cyan: { 50: "#EDFDFD", 100: "#C4F1F9", 200: "#9DECF9", 300: "#76E4F7", 400: "#0BC5EA", 500: "#00B5D8", 600: "#00A3C4", 700: "#0987A0", 800: "#086F83", 900: "#065666" },
  purple: { 50: "#FAF5FF", 100: "#E9D8FD", 200: "#D6BCFA", 300: "#B794F4", 400: "#9F7AEA", 500: "#805AD5", 600: "#6B46C1", 700: "#553C9A", 800: "#44337A", 900: "#322659" },
  pink: { 50: "#FFF5F7", 100: "#FED7E2", 200: "#FBB6CE", 300: "#F687B3", 400: "#ED64A6", 500: "#D53F8C", 600: "#B83280", 700: "#97266D", 800: "#702459", 900: "#521B41" },
  gray: { 50: "#F7FAFC", 100: "#EDF2F7", 200: "#E2E8F0", 300: "#CBD5E0", 400: "#A0AEC0", 500: "#718096", 600: "#4A5568", 700: "#2D3748", 800: "#1A202C", 900: "#171923", 950: "#0d1117" },
};

export const getChakraColorHex = (color?, opacity?) => {
  if (color?.startsWith("#")) return color;
  if (!color) return "whitesmoke";

  const formattedColor = color.replace(/\./g, "-");

  try {
    const computedStyle = getComputedStyle(document.documentElement);
    const hexValue = computedStyle.getPropertyValue(`--chakra-colors-${formattedColor}`).trim();
    if (hexValue && hexValue !== "") return hexValue;
  } catch (error) {}

  const [name, shade] = color.split(".");
  if (name && shade && CHAKRA_COLOR_MAP[name]?.[Number(shade)]) {
    return CHAKRA_COLOR_MAP[name][Number(shade)];
  }

  return `var(--chakra-colors-${formattedColor})`;
};
