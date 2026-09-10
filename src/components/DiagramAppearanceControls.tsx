import styled from "@emotion/styled";
import {
  forwardRef,
  useId,
  type ComponentProps,
  type CSSProperties,
} from "react";
import {
  PiArrowsOutCardinal,
  PiBezierCurve,
  PiDotsNine,
  PiGridFour,
  PiLineSegments,
  PiSelection,
  PiSquareFill,
} from "react-icons/pi";
import { useCustomColors } from "../theme/useCustomColors";
import type { BackgroundVariant } from "../types";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { ToolbarDivider, ToolbarSelect } from "./toolbarControls";

const StyledRangeInput = styled.input`
  appearance: none;
  width: 100%;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  box-shadow: none;
  background-color: transparent;
  background-size: 0 0;
  background-position: center;
  background-repeat: no-repeat;
  cursor: pointer;
  &::-webkit-slider-runnable-track {
    height: 6px;
    background: var(--flow-range-track, transparent);
    background-size: 100% 100%;
    border-radius: 999px;
    border: 0;
    box-shadow: none;
  }
  &::-moz-range-track {
    height: 6px;
    background: var(--flow-range-track, transparent);
    background-size: 100% 100%;
    border-radius: 999px;
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

export const RangeInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function RangeInput({ style, ...props }, ref) {
    return (
      <StyledRangeInput
        {...props}
        ref={ref}
        style={
          {
            ...style,
            backgroundImage: "none",
            "--flow-range-track": style?.backgroundImage ?? "none",
          } as CSSProperties
        }
      />
    );
  },
);

export function SliderContent({
  label,
  inputLabel,
  value,
  displayValue,
  min,
  max,
  step = 5,
  onChange,
  onChangeEnd,
}: {
  label: string;
  inputLabel: string;
  value: number;
  displayValue: string | number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeEnd?: () => void;
}) {
  const id = useId();
  const { readOnly, themeColor } = useFlowDiagramContext();
  const { colorInactive } = useCustomColors();
  const progress = ((value - min) / (max - min)) * 100;
  const accent = themeColor.includes(".")
    ? `var(--chakra-colors-${themeColor.replace(".", "-")})`
    : themeColor;
  return (
    <div style={{ width: 224, maxWidth: "calc(100vw - 64px)", padding: 12 }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 14,
          marginBottom: 12,
        }}
      >
        {label} <span>{displayValue}</span>
      </label>
      <RangeInput
        id={id}
        aria-label={inputLabel}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={readOnly}
        style={{
          color: accent,
          accentColor: accent,
          backgroundImage: `linear-gradient(to right, currentColor ${progress}%, var(--chakra-colors-${colorInactive.replace(".", "-")}) ${progress}%)`,
        }}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onChangeEnd}
        onKeyUp={onChangeEnd}
        onBlur={onChangeEnd}
      />
    </div>
  );
}

const backgrounds = {
  dot: { label: "Dots", icon: PiDotsNine },
  grid: { label: "Grid", icon: PiGridFour },
  steel: { label: "Steel", icon: PiLineSegments },
  none: { label: "Solid", icon: PiSquareFill },
  transparent: { label: "Transparent", icon: PiSelection },
};

export function DiagramAppearanceControls() {
  const {
    spacing,
    setSpacing,
    edgeRadius,
    setEdgeRadius,
    backgroundVariant,
    setBackgroundVariant,
    callbacks,
    readOnly,
    config,
  } = useFlowDiagramContext();
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
          <SliderContent
            label="Spacing"
            inputLabel="Node spacing percentage"
            min={config.nodeGridSpacing === "layout" ? 0 : 50}
            max={200}
            value={Math.round(spacing * 100)}
            displayValue={`${Math.round(spacing * 100)}%`}
            onChange={(value) => {
              setSpacing(value / 100);
              callbacks.onSpacingChange?.(value / 100);
            }}
          />
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
          <SliderContent
            label="Edge radius"
            inputLabel="Edge corner radius"
            min={0}
            max={500}
            value={edgeRadius ?? 500}
            displayValue={edgeRadius ?? "Default"}
            onChange={(value) => {
              setEdgeRadius(value);
              callbacks.onEdgeRadiusChange?.(value);
            }}
          />
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
