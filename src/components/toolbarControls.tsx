import { IconButton, Tooltip, chakra } from "@chakra-ui/react";
import { useFlowDiagramContext } from "./FlowDiagramContext";

export function ToolbarTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  if (!Tooltip.Root) {
    const LegacyTooltip = Tooltip as unknown as React.ComponentType<{
      label: string;
      placement: "top";
      fontSize: "xs";
      children: React.ReactElement;
    }>;
    return (
      <LegacyTooltip label={label} placement="top" fontSize="xs">
        {children}
      </LegacyTooltip>
    );
  }

  return (
    <Tooltip.Root positioning={{ placement: "top" }}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content fontSize="xs">{label}</Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}

export function ToolbarSelect(props: React.ComponentProps<"select">) {
  const { colorMode } = useFlowDiagramContext();
  const dark = colorMode === "dark";
  return (
    <chakra.select
      h="30px"
      w="160px"
      px="6px"
      fontSize="12px"
      border="none"
      borderRadius="4px"
      bg="transparent"
      color={dark ? "gray.200" : "gray.800"}
      _hover={{ bg: "transparent" }}
      css={{ "& option": { background: dark ? "var(--chakra-colors-gray-800)" : "var(--chakra-colors-white)" } }}
      {...props}
    />
  );
}

export function ToolbarIconButton({
  icon,
  ...props
}: React.ComponentProps<typeof IconButton> & { icon: React.ReactElement }) {
  const { colorMode } = useFlowDiagramContext();
  return (
    <IconButton
      _hover={{ bg: colorMode === "dark" ? "whiteAlpha.100" : "blackAlpha.50" }}
      {...props}
    >
      {icon}
    </IconButton>
  );
}
