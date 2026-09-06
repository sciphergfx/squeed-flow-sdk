import { IconButton, Portal, Tooltip, chakra } from "@chakra-ui/react";
import { startCase } from "lodash";
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PiCaretUp, PiCheck, PiXLight } from "react-icons/pi";
import { useCustomColors } from "../theme/useCustomColors";
import { useFlowDiagramContext } from "./FlowDiagramContext";

export function ToolbarTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  const trigger = cloneElement(children, {
    title: children.props.title ?? label,
  });
  if (!Tooltip.Root) {
    const LegacyTooltip = Tooltip as unknown as React.ComponentType<{
      label: string;
      placement: "top";
      fontSize: "xs";
      borderRadius: string;
      children: React.ReactElement;
    }>;
    return (
      <LegacyTooltip
        label={label}
        placement="top"
        fontSize="xs"
        borderRadius="15px"
      >
        {trigger}
      </LegacyTooltip>
    );
  }

  return (
    <Tooltip.Root positioning={{ placement: "top" }}>
      <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content fontSize="xs" borderRadius="15px">
            {label}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}

export function ToolbarDivider() {
  const { border } = useCustomColors();
  return (
    <chakra.span
      role="separator"
      aria-orientation="vertical"
      display="block"
      flexShrink={0}
      w="1px"
      h="20px"
      mx="4px"
      bg={border}
    />
  );
}

export function ToolbarSelect({
  children,
  value,
  onValueChange,
  disabled,
  style,
  title,
  icon,
  popupContent,
  labelCase = "title",
  "aria-label": label,
}: {
  children: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  style?: CSSProperties;
  title?: string;
  icon?: ReactNode;
  popupContent?: ReactNode;
  labelCase?: "title" | "preserve";
  "aria-label": string;
}) {
  const { colorMode } = useFlowDiagramContext();
  const { background, border, colorText, colorActive, colorInactive } =
    useCustomColors();
  const dark = colorMode === "dark";
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const panel = menu.current!;
    panel.setAttribute("popover", "auto");
    const toggle = (event: Event) =>
      setOpen((event as ToggleEvent).newState === "open");
    panel.addEventListener("toggle", toggle);
    return () => panel.removeEventListener("toggle", toggle);
  }, []);
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = child.props as {
        value: string;
        children: ReactNode;
        disabled?: boolean;
      };
      return {
        value: String(props.value),
        label:
          typeof props.children === "string" && labelCase === "title"
            ? startCase(props.children)
            : props.children,
        disabled: props.disabled,
      };
    });
  const close = () => menu.current?.hidePopover();
  const position = () => {
    const anchor = trigger.current?.getBoundingClientRect();
    const panel = menu.current;
    if (!anchor || !panel) return;
    const toolbar = trigger.current
      ?.closest("[data-flow-toolbar-scroll]")
      ?.parentElement?.getBoundingClientRect();
    const verticalAnchor = toolbar ?? anchor;
    panel.style.maxHeight = `${Math.max(60, Math.max(verticalAnchor.top - 40, window.innerHeight - verticalAnchor.bottom - 40))}px`;
    const bounds = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(12, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 12))}px`;
    panel.style.top = `${Math.max(12, verticalAnchor.top >= bounds.height + 36 ? verticalAnchor.top - bounds.height - 24 : Math.min(verticalAnchor.bottom + 24, window.innerHeight - bounds.height - 12))}px`;
  };
  const show = () => {
    if (disabled) return;
    menu.current?.showPopover();
    position();
    if (popupContent) {
      menu.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
      return;
    }
    const items = menu.current?.querySelectorAll<HTMLButtonElement>(
      '[role="option"]:not(:disabled)',
    );
    const selected = menu.current?.querySelector<HTMLButtonElement>(
      '[aria-selected="true"]:not(:disabled)',
    );
    (selected ?? items?.[0])?.focus();
  };
  useEffect(() => {
    if (!open) return;
    if (disabled) {
      close();
      return;
    }
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, disabled]);
  const surface = `var(--chakra-colors-${background.replace(".", "-")})`;
  return (
    <>
      <ToolbarTooltip label={title ?? label}>
        <chakra.button
          ref={trigger}
          type="button"
          role="combobox"
          data-flow-select-icon={icon ? "" : undefined}
          aria-label={label}
          title={title ?? label}
          aria-haspopup={popupContent ? "dialog" : "listbox"}
          aria-expanded={open}
          aria-controls={id}
          disabled={disabled}
          h="30px"
          w="160px"
          px="6px"
          fontSize="12px"
          border="none"
          borderRadius="4px"
          bg="transparent"
          color={icon ? colorInactive : colorText}
          display="flex"
          alignItems="center"
          justifyContent={icon ? "center" : "space-between"}
          gap={2}
          style={style}
          onClick={() => (open ? close() : show())}
          onKeyDown={(event) => {
            if (["ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              show();
            }
          }}
        >
          {icon ?? (
            <>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {options.find((option) => option.value === value)?.label ??
                  value}
              </span>
              <PiCaretUp size={16} style={{ flexShrink: 0 }} />
            </>
          )}
        </chakra.button>
      </ToolbarTooltip>
      <chakra.div
        ref={menu}
        id={id}
        role={popupContent ? "dialog" : "listbox"}
        aria-label={label}
        position="fixed"
        m={0}
        p={2}
        minW="180px"
        maxW="calc(100vw - 24px)"
        overflowY="auto"
        css={{
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
        bg={background}
        color={colorText}
        borderWidth={1}
        borderColor={dark ? border : "gray.300"}
        borderRadius="30px"
        boxShadow={`0 0 0 8px color-mix(in srgb, ${surface} 40%, transparent), var(--chakra-shadows-lg)`}
        onKeyDown={(event) => {
          if (popupContent && !["Escape", "Tab"].includes(event.key)) return;
          const items = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="option"]:not(:disabled)',
            ),
          ];
          const index = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (index +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      items.length) %
                    items.length;
            items[next]?.focus();
          } else if (event.key === "Escape" || event.key === "Tab") {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
            }
            close();
            trigger.current?.focus();
          } else if (event.key.length === 1 && event.key !== " ") {
            items
              .find(
                (item, itemIndex) =>
                  itemIndex > index &&
                  item.textContent
                    ?.toLowerCase()
                    .startsWith(event.key.toLowerCase()),
              )
              ?.focus();
          }
        }}
      >
        {popupContent ??
          options.map((option) => (
            <chakra.button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              tabIndex={-1}
              display="flex"
              alignItems="center"
              gap={3}
              px={3}
              py={2}
              w="100%"
              borderRadius="30px"
              fontSize="sm"
              textAlign="left"
              bg="transparent"
              color={colorText}
              _hover={{ bg: dark ? "whiteAlpha.100" : "blackAlpha.50" }}
              _focusVisible={{ bg: dark ? "whiteAlpha.100" : "blackAlpha.50" }}
              onClick={() => {
                close();
                trigger.current?.focus();
                onValueChange(option.value);
              }}
            >
              <span style={{ flex: 1 }}>{option.label}</span>
              <PiCheck
                size={16}
                color={`var(--chakra-colors-${colorActive.replace(".", "-")})`}
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  visibility: option.value === value ? "visible" : "hidden",
                }}
              />
            </chakra.button>
          ))}
      </chakra.div>
    </>
  );
}

export const ToolbarIconButton = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof IconButton> & { icon: React.ReactElement }
>(function ToolbarIconButton({ icon, ...props }, ref) {
  const { colorMode } = useFlowDiagramContext();
  return (
    <IconButton
      ref={ref}
      _hover={{ bg: colorMode === "dark" ? "whiteAlpha.100" : "blackAlpha.50" }}
      title={props.title ?? props["aria-label"]}
      {...props}
    >
      {icon}
    </IconButton>
  );
});

export const ToolbarCloseButton = forwardRef<
  HTMLButtonElement,
  Omit<React.ComponentProps<typeof IconButton>, "children">
>(function ToolbarCloseButton(props, ref) {
  const { themeColor } = useFlowDiagramContext();
  return (
    <ToolbarTooltip label="Close">
      <ToolbarIconButton
        ref={ref}
        size="sm"
        variant="ghost"
        color={themeColor}
        focusRingColor={themeColor}
        {...props}
        aria-label={props["aria-label"] ?? "Close selection tools"}
        icon={<PiXLight size={20} aria-hidden="true" />}
      />
    </ToolbarTooltip>
  );
});
