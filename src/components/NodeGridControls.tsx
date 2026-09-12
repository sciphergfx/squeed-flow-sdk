import { Box, HStack, Text } from "@chakra-ui/react";
import { PiArrowsHorizontal, PiArrowsOut, PiGridFour } from "react-icons/pi";
import type { NodeGridOptions } from "../engine/nodeCollisions";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import { RangeInput } from "./DiagramAppearanceControls";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { LabeledToolbarToggle } from "./LabeledToolbarToggle";

export function GridAdjustmentToggle() {
  const { engineRef, nodeGridOptions, readOnly } = useFlowDiagramContext();
  const available = !!nodeGridOptions?.fill;
  return (
    <LabeledToolbarToggle
      label="Grid adjustment"
      hideLabel
      helper={
        available
          ? "Grid adjustment"
          : "Enable Collision and Fill to adjust the Grid"
      }
      icon={<PiArrowsHorizontal size={20} />}
      checked={available && !!nodeGridOptions?.adjustment?.enabled}
      disabled={!available}
      onChange={(enabled) => {
        if (readOnly || !nodeGridOptions?.fill) return;
        engineRef.current?.setNodeGridMode(true, {
          ...nodeGridOptions,
          adjustment: { ...nodeGridOptions.adjustment, enabled },
        });
      }}
    />
  );
}

export function NodeGridControls({
  fillOnly = false,
}: { fillOnly?: boolean } = {}) {
  const {
    engineRef,
    nodeGridOptions,
    lastNodeGridOptions,
    readOnly,
    themeColor,
    callbacks,
    config,
  } = useFlowDiagramContext();
  const { colorText, colorInactive } = useCustomColors();
  const options = nodeGridOptions ?? lastNodeGridOptions;
  const gap =
    typeof options.gaps === "object"
      ? options.gaps.x
      : (options.gaps ?? options.margin ?? 15);
  const maximum = Math.max(200, gap);
  const change = (next: NodeGridOptions) =>
    engineRef.current?.setNodeGridMode(true, { ...options, ...next });
  return (
    <>
      {!fillOnly && config.bottomBarCollision !== false && (
        <LabeledToolbarToggle
          label="Collision mode"
          hideLabel
          icon={<PiGridFour size={20} />}
          checked={nodeGridOptions !== null}
          onChange={(enabled) => {
            if (callbacks.onNodeGridModeRequest?.(enabled, options) === true)
              return;
            engineRef.current?.setNodeGridMode(enabled, options);
          }}
        />
      )}
      {(nodeGridOptions || config.bottomBarFill === true) && (
        <HStack
          role="group"
          aria-label="Collision settings"
          gap={2}
          flexShrink={0}
        >
          {!fillOnly &&
            nodeGridOptions &&
            config.nodeGridSpacing !== "layout" && (
              <>
                <Box
                  width="96px"
                  flexShrink={0}
                  display="flex"
                  alignItems="center"
                >
                  <RangeInput
                    type="range"
                    aria-label="Collision gap"
                    title={`Gap: ${gap}`}
                    min={0}
                    max={maximum}
                    step={5}
                    value={gap}
                    disabled={readOnly}
                    style={{
                      color: getChakraColorHex(themeColor),
                      backgroundImage: `linear-gradient(to right, currentColor ${(gap / maximum) * 100}%, ${getChakraColorHex(colorInactive)} ${(gap / maximum) * 100}%)`,
                    }}
                    onChange={(event) =>
                      change({ gaps: Number(event.target.value) })
                    }
                  />
                </Box>
                <Text
                  fontSize="xs"
                  color={colorText}
                  width="28px"
                  textAlign="right"
                  fontVariantNumeric="tabular-nums"
                >
                  {gap}
                </Text>
              </>
            )}
          {config.bottomBarFill !== false && (
            <LabeledToolbarToggle
              label="Fill"
              hideLabel
              helper={
                nodeGridOptions
                  ? "Fill available canvas space"
                  : "Enable Collision mode to use Fill"
              }
              icon={<PiArrowsOut size={18} />}
              checked={!!nodeGridOptions && !!options.fill}
              disabled={!nodeGridOptions}
              onChange={(fill) => {
                if (
                  !nodeGridOptions &&
                  callbacks.onNodeGridModeRequest?.(true, {
                    ...options,
                    fill,
                  }) === true
                )
                  return;
                if (
                  fill &&
                  callbacks.onNodeGridFillRequest?.({ ...options, fill }) ===
                    true
                )
                  return;
                change({ fill });
              }}
            />
          )}
          {!fillOnly && nodeGridOptions && options.fill && (
            <GridAdjustmentToggle />
          )}
        </HStack>
      )}
    </>
  );
}
