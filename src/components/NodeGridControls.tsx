import { Box, HStack, Text } from "@chakra-ui/react";
import { PiArrowsHorizontal, PiArrowsOut, PiGridFour } from "react-icons/pi";
import type { NodeGridOptions } from "../engine/nodeCollisions";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import { RangeInput } from "./DiagramAppearanceControls";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { LabeledToolbarToggle } from "./LabeledToolbarToggle";

export function NodeGridControls() {
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
      {config.bottomBarCollision !== false && (
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
      {nodeGridOptions && (
        <HStack
          role="group"
          aria-label="Collision settings"
          gap={2}
          flexShrink={0}
        >
          {nodeGridOptions && config.nodeGridSpacing !== "layout" && (
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
              helper="Fill available canvas space"
              icon={<PiArrowsOut size={18} />}
              checked={!!nodeGridOptions && !!options.fill}
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
          {nodeGridOptions && options.fill && (
            <LabeledToolbarToggle
              label="Grid adjustment"
              hideLabel
              icon={<PiArrowsHorizontal size={20} />}
              checked={!!options.adjustment?.enabled}
              onChange={(enabled) => {
                if (!readOnly)
                  change({ adjustment: { ...options.adjustment, enabled } });
              }}
            />
          )}
        </HStack>
      )}
    </>
  );
}
