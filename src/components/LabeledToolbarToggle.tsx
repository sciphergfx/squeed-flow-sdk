import { Text } from "@chakra-ui/react";
import type { ReactElement } from "react";
import { PiArrowsInLineVertical } from "react-icons/pi";
import { useCustomColors } from "../theme/useCustomColors";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { ToolbarIconButton, ToolbarTooltip } from "./toolbarControls";

export function CollapseAllToggle({
  onBeforeExpand,
}: { onBeforeExpand?: () => void } = {}) {
  const { allNodesIconLabel, setAllNodesIconLabel } = useFlowDiagramContext();
  return (
    <LabeledToolbarToggle
      label="Collapse all"
      hideLabel
      checked={allNodesIconLabel}
      icon={<PiArrowsInLineVertical size={20} />}
      onChange={(enabled) => {
        if (!enabled) onBeforeExpand?.();
        setAllNodesIconLabel(enabled);
      }}
    />
  );
}

export function LabeledToolbarToggle({
  label,
  icon,
  checked,
  onChange,
  disabled,
  hideLabel = false,
  helper = label,
}: {
  label: string;
  icon: ReactElement;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  helper?: string;
}) {
  const { themeColor, readOnly } = useFlowDiagramContext();
  const { colorInactive } = useCustomColors();
  return (
    <ToolbarTooltip label={helper}>
      <ToolbarIconButton
        aria-label={label}
        aria-pressed={checked}
        icon={
          <>
            {icon}
            {!hideLabel && (
              <Text
                as="span"
                fontSize="16px"
                fontWeight={checked ? "bold" : "normal"}
                whiteSpace="nowrap"
              >
                {label}
              </Text>
            )}
          </>
        }
        size="sm"
        variant="ghost"
        width="auto"
        px={2}
        gap={2}
        color={checked ? themeColor : colorInactive}
        disabled={disabled || readOnly}
        onClick={() => onChange(!checked)}
      />
    </ToolbarTooltip>
  );
}
