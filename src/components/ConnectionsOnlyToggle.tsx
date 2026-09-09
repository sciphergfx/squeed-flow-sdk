import { Icon } from "@chakra-ui/react";
import { PiGraph } from "react-icons/pi";
import { LabeledToolbarToggle } from "./LabeledToolbarToggle";

export interface ConnectionsOnlyToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function ConnectionsOnlyToggle({
  checked,
  onChange,
  disabled,
  label = "Connected nodes",
}: ConnectionsOnlyToggleProps) {
  return (
    <LabeledToolbarToggle
      hideLabel
      label={label}
      helper={`${label}: isolate node and its connections`}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      icon={<Icon as={PiGraph} boxSize={5} />}
    />
  );
}
