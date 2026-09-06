import { Icon } from "@chakra-ui/react";
import { PiGraph } from "react-icons/pi";
import { useCustomColors } from "../theme/useCustomColors";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { ToolbarIconButton, ToolbarTooltip } from "./toolbarControls";

export interface ConnectionsOnlyToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ConnectionsOnlyToggle({
  checked,
  onChange,
  disabled,
}: ConnectionsOnlyToggleProps) {
  const { colorInactive } = useCustomColors();
  const { themeColor } = useFlowDiagramContext();
  return (
    <ToolbarTooltip label="Only connected nodes">
      <ToolbarIconButton
        aria-label="Only connected nodes"
        aria-pressed={checked}
        icon={<Icon as={PiGraph} boxSize={5} />}
        size="sm"
        variant="ghost"
        color={checked ? themeColor : colorInactive}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </ToolbarTooltip>
  );
}
