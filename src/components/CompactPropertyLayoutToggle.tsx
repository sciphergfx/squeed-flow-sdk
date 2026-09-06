import { Icon } from "@chakra-ui/react";
import { PiArrowsIn } from "react-icons/pi";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { LabeledToolbarToggle } from "./LabeledToolbarToggle";

export function CompactPropertyLayoutToggle({
  label = "Compact layout",
}: { label?: string } = {}) {
  const { compactPropertyLayout, setCompactPropertyLayout, callbacks } =
    useFlowDiagramContext();
  return (
    <LabeledToolbarToggle
      label={label}
      checked={compactPropertyLayout}
      icon={<Icon as={PiArrowsIn} boxSize={5} />}
      onChange={(enabled) => {
        setCompactPropertyLayout(enabled);
        callbacks.onCompactPropertyLayoutChange?.(enabled);
      }}
    />
  );
}
