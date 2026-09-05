import {
  PiArrowsOutCardinal,
  PiGridFour,
  PiDotsNine,
  PiSelection,
  PiSquareFill,
  PiLineSegments,
  PiBezierCurve,
} from "react-icons/pi";
import { useId } from "react";
import styled from "@emotion/styled";
import type { BackgroundVariant } from "../types";
import { useCustomColors } from "../theme/useCustomColors";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { ToolbarSelect, ToolbarDivider } from "./toolbarControls";

const SpacingSlider = styled.input`
  appearance: none;
  width: 100%;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  box-shadow: none;
  background-color: transparent;
  background-size: 100% 6px;
  background-position: center;
  background-repeat: no-repeat;
  cursor: pointer;
  &::-webkit-slider-runnable-track {
    height: 6px;
    background: transparent;
    border: 0;
    box-shadow: none;
  }
  &::-moz-range-track {
    height: 6px;
    background: transparent;
    border: 0;
    box-shadow: none;
  }
  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border: 0;
    border-radius: 50%;
    background: currentColor;
    box-shadow: none;
  }
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: 0;
    border-radius: 50%;
    background: currentColor;
    box-shadow: none;
  }
  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

export function DiagramAppearanceControls() {
  const sliderId = useId();
  const radiusSliderId = useId();
  const { colorInactive } = useCustomColors();
  const {
    spacing,
    setSpacing,
    edgeRadius,
    setEdgeRadius,
    backgroundVariant,
    setBackgroundVariant,
    callbacks,
    readOnly,
    themeColor,
  } = useFlowDiagramContext();
  const progress = ((spacing - 0.5) / 1.5) * 100;
  const accent = themeColor.includes(".")
    ? `var(--chakra-colors-${themeColor.replace(".", "-")})`
    : themeColor;
  const backgrounds = {
    dot: { label: "Dots", icon: PiDotsNine },
    grid: { label: "Grid", icon: PiGridFour },
    steel: { label: "Steel", icon: PiLineSegments },
    none: { label: "Solid", icon: PiSquareFill },
    transparent: { label: "Transparent", icon: PiSelection },
  };
  const BackgroundIcon = backgrounds[backgroundVariant].icon;
  return (
    <>
      <ToolbarDivider />
      <ToolbarSelect
        aria-label="Node spacing"
        title={`Spacing: ${Math.round(spacing * 100)}%`}
        icon={<PiArrowsOutCardinal size={20} />}
        style={{ width: 36 }}
        value="spacing"
        disabled={readOnly}
        onValueChange={() => {}}
        popupContent={
          <div
            style={{ width: 224, maxWidth: "calc(100vw - 64px)", padding: 12 }}
          >
            <label
              htmlFor={sliderId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                marginBottom: 12,
              }}
            >
              Spacing <span>{Math.round(spacing * 100)}%</span>
            </label>
            <SpacingSlider
              id={sliderId}
              aria-label="Node spacing percentage"
              type="range"
              min={50}
              max={200}
              step={5}
              value={Math.round(spacing * 100)}
              disabled={readOnly}
              style={{
                color: accent,
                accentColor: accent,
                backgroundImage: `linear-gradient(to right, currentColor ${progress}%, var(--chakra-colors-${colorInactive.replace(".", "-")}) ${progress}%)`,
              }}
              onChange={(event) => {
                const next = Number(event.target.value) / 100;
                setSpacing(next);
                callbacks.onSpacingChange?.(next);
              }}
            />
          </div>
        }
      >
        <option value="spacing">Spacing</option>
      </ToolbarSelect>
      <ToolbarDivider />
      <ToolbarSelect
        aria-label="Edge radius"
        title={`Edge radius: ${edgeRadius ?? "Default"}`}
        icon={<PiBezierCurve size={20} />}
        style={{ width: 36 }}
        value="radius"
        disabled={readOnly}
        onValueChange={() => {}}
        popupContent={
          <div style={{ width: 224, maxWidth: "calc(100vw - 64px)", padding: 12 }}>
            <label htmlFor={radiusSliderId} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 12 }}>
              Edge radius <span>{edgeRadius ?? "Default"}</span>
            </label>
            <SpacingSlider
              id={radiusSliderId}
              aria-label="Edge corner radius"
              type="range"
              min={0}
              max={500}
              step={5}
              value={edgeRadius ?? 500}
              disabled={readOnly}
              style={{ color: accent, accentColor: accent, backgroundImage: `linear-gradient(to right, currentColor ${(edgeRadius ?? 500) / 5}%, var(--chakra-colors-${colorInactive.replace(".", "-")}) ${(edgeRadius ?? 500) / 5}%)` }}
              onChange={event => {
                const next = Number(event.target.value);
                setEdgeRadius(next);
                callbacks.onEdgeRadiusChange?.(next);
              }}
            />
          </div>
        }
      >
        <option value="radius">Edge radius</option>
      </ToolbarSelect>
      <ToolbarDivider />
      <ToolbarSelect
        aria-label="Background variant"
        title={`Background: ${backgrounds[backgroundVariant].label}`}
        icon={
          <BackgroundIcon size={20} data-background-icon={backgroundVariant} />
        }
        style={{ width: 36 }}
        value={backgroundVariant}
        disabled={readOnly}
        onValueChange={(value) => {
          setBackgroundVariant(value as BackgroundVariant);
          callbacks.onBackgroundVariantChange?.(value as BackgroundVariant);
        }}
      >
        <option value="dot">Dots</option>
        <option value="grid">Grid</option>
        <option value="steel">Steel</option>
        <option value="none">Solid</option>
        <option value="transparent">Transparent</option>
      </ToolbarSelect>
    </>
  );
}
