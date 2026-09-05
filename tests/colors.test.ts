import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contentObjTheme,
  getChakraColorHex,
  getColorVariant,
} from "../src/theme/colorUtils";
import { useThemeContentColors } from "../src/theme/useCustomColors";

test("transparent resolves as a CSS color without requiring a browser or Chakra token", () => {
  assert.equal(getChakraColorHex("transparent"), "transparent");
  assert.deepEqual(getColorVariant("transparent"), {
    primary: "transparent",
    secondary: "transparent",
    light: "transparent",
  });
});

test("transparent surfaces never produce invalid derived color tokens", () => {
  const theme = contentObjTheme("transparent");
  assert.equal(theme.background, "transparent");
  assert.equal(theme.highlight, "transparent");
  assert.equal(theme.border, "transparent");
  const colors = useThemeContentColors("transparent");
  assert.equal(colors.bgColorFaint, "transparent");
  assert.equal(colors.highlightColorFaint, "transparent");
});

test("existing token and hex colors keep their resolution", () => {
  assert.equal(getChakraColorHex("green.500"), "#38A169");
  assert.equal(getChakraColorHex("#123456"), "#123456");
  assert.equal(contentObjTheme("blue").background, "blue.100");
});
