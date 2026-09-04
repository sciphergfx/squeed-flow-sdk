import { IconButton, Tooltip } from "@chakra-ui/react";

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

export function ToolbarIconButton({
  icon,
  ...props
}: React.ComponentProps<typeof IconButton> & { icon: React.ReactElement }) {
  return <IconButton {...props}>{icon}</IconButton>;
}
