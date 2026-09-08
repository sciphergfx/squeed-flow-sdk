import { Text } from "@chakra-ui/react";
import type { ReactElement } from "react";
import { useCustomColors } from "../theme/useCustomColors";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { ToolbarIconButton, ToolbarTooltip } from "./toolbarControls";

export function LabeledToolbarToggle({
  label,
  icon,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  icon: ReactElement;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const { themeColor, readOnly } = useFlowDiagramContext();
  const { colorInactive } = useCustomColors();
  return (
    <ToolbarTooltip label={label}>
      <ToolbarIconButton
        aria-label={label}
        aria-pressed={checked}
        icon={
          <>
            {icon}
            <Text
              as="span"
              fontSize="16px"
              fontWeight={checked ? "bold" : "normal"}
              whiteSpace="nowrap"
            >
              {label}
            </Text>
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
