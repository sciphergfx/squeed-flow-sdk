import { IconButton, Portal, Tooltip, chakra } from "@chakra-ui/react";
import { startCase } from "lodash";
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PiCaretUp, PiCheck, PiXLight } from "react-icons/pi";
import { getInteractionSurface } from "../theme/interactionShadow";
import { useCustomColors } from "../theme/useCustomColors";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { useRecentToolbarAction } from "./RecentToolbarAction";

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
  const { colorMode } = useFlowDiagramContext();
  return (
    <chakra.span
      role="separator"
      aria-orientation="vertical"
      display="block"
      flexShrink={0}
      w="1px"
      h="20px"
      mx="4px"
      bg={colorMode === "dark" ? border : "gray.300"}
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
  footer,
  pinned = false,
  open: requestedOpen,
  onOpenChange,
  labelCase = "title",
  "aria-label": label,
  ...triggerProps
}: {
  children: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  style?: CSSProperties;
  title?: string;
  icon?: ReactNode;
  popupContent?: ReactNode;
  footer?: ReactNode;
  pinned?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  labelCase?: "title" | "preserve";
  "aria-label": string;
} & Pick<
  React.ComponentProps<"button">,
  "id" | "aria-required" | "aria-invalid" | "aria-describedby"
>) {
  const { colorMode } = useFlowDiagramContext();
  const { background, border, colorText, colorInactive } = useCustomColors();
  const dark = colorMode === "dark";
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const remember = useRecentToolbarAction(
    <ToolbarSelect
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      style={style}
      title={title}
      icon={icon}
      popupContent={popupContent}
      footer={footer}
      pinned={pinned}
      labelCase={labelCase}
      aria-label={label}
    >
      {children}
    </ToolbarSelect>,
    !!icon,
  );
  useLayoutEffect(() => {
    const panel = menu.current!;
    const wasOpen = panel.matches(":popover-open");
    const focused = document.activeElement instanceof HTMLElement && panel.contains(document.activeElement) ? document.activeElement : null;
    const scroll = [panel, ...panel.querySelectorAll<HTMLElement>("*")]
      .filter((element) => element.scrollTop || element.scrollLeft)
      .map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }));
    const mode = pinned ? "manual" : "auto";
    if (panel.getAttribute("popover") !== mode) panel.setAttribute("popover", mode);
    if (wasOpen) {
      panel.showPopover();
      focused?.focus({ preventScroll: true });
      for (const { element, top, left } of scroll) {
        element.scrollTop = top;
        element.scrollLeft = left;
      }
    }
    const toggle = (event: Event) => {
      const next = (event as ToggleEvent).newState === "open";
      setOpen(next);
      onOpenChange?.(next);
    };
    panel.addEventListener("toggle", toggle);
    return () => panel.removeEventListener("toggle", toggle);
  }, [pinned, onOpenChange]);
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
    if (trigger.current?.closest("[popover]")) {
      const below = window.innerHeight - anchor.bottom - 16;
      const above = anchor.top - 16;
      panel.style.maxHeight = `${Math.max(60, below, above)}px`;
      const bounds = panel.getBoundingClientRect();
      panel.style.left = `${Math.max(12, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 12))}px`;
      panel.style.top = `${Math.max(12, bounds.height <= below ? anchor.bottom + 4 : anchor.top - bounds.height - 4)}px`;
      return;
    }
    const toolbar = trigger.current
      ?.closest("[data-flow-toolbar-scroll]")
      ?.parentElement?.getBoundingClientRect();
    const verticalAnchor = toolbar ?? anchor;
    panel.style.maxHeight = `${Math.max(60, Math.max(verticalAnchor.top - 40, window.innerHeight - verticalAnchor.bottom - 40))}px`;
    const bounds = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(12, Math.min(Math.max(toolbar?.left ?? 12, anchor.right - bounds.width), (toolbar?.right ?? window.innerWidth - 12) - bounds.width, window.innerWidth - bounds.width - 12))}px`;
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
  useLayoutEffect(() => {
    if (requestedOpen === undefined) return;
    if (requestedOpen) show();
    else close();
  }, [requestedOpen]);
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
          {...triggerProps}
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
          onClick={() => {
            remember();
            open ? close() : show();
          }}
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
        data-flow-select-pinned={pinned ? "" : undefined}
        role={popupContent ? "dialog" : "listbox"}
        aria-label={label}
        position="fixed"
        m={0}
        p={2}
        minW="180px"
        maxW="calc(100vw - 24px)"
        gridTemplateColumns={footer && popupContent ? "minmax(0, 1fr)" : undefined}
        gridTemplateRows={footer && popupContent ? "minmax(0, 1fr) auto" : undefined}
        overflowY={footer && popupContent ? "hidden" : "auto"}
        bg={background}
        color={colorText}
        borderRadius="30px"
        css={{
          "&:popover-open": { display: footer && popupContent ? "grid" : undefined },
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          '& [role="option"]': menuItemCorners,
          '& details [role="option"]:first-child': {
            borderTopLeftRadius: "4px",
            borderTopRightRadius: "4px",
          },
          ...getInteractionSurface(
            surface,
            `var(--chakra-colors-${(dark ? border : "gray.300").replace(".", "-")})`,
          ),
        }}
        onKeyDown={(event) => {
          if (popupContent && !["Escape", "Tab"].includes(event.key)) return;
          const items = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="option"]:not(:disabled), [data-flow-menu-action]:not(:disabled)',
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
            if (event.key === "Tab" && pinned) return;
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
              fontSize="sm"
              textAlign="left"
              bg="transparent"
              color={colorText}
              _hover={{ bg: dark ? "whiteAlpha.100" : "blackAlpha.50" }}
              _focusVisible={{ bg: dark ? "whiteAlpha.100" : "blackAlpha.50" }}
              onClick={() => {
                if (!pinned) {
                  close();
                  trigger.current?.focus();
                }
                onValueChange(option.value);
              }}
            >
              <span style={{ flex: 1 }}>{option.label}</span>
              <PiCheck
                size={16}
                color={`var(--chakra-colors-${colorText.replace(".", "-")})`}
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  visibility: option.value === value ? "visible" : "hidden",
                }}
              />
            </chakra.button>
          ))}
        {footer}
      </chakra.div>
    </>
  );
}

export const menuItemCorners = {
  borderRadius: "4px",
  "&:first-child": {
    borderTopLeftRadius: "22px",
    borderTopRightRadius: "22px",
  },
  "&:last-child": {
    borderBottomLeftRadius: "22px",
    borderBottomRightRadius: "22px",
  },
};

export const ToolbarIconButton = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof IconButton> & {
    icon: React.ReactElement;
    rememberAction?: boolean;
  }
>(function ToolbarIconButtonImpl(
  { icon, rememberAction = true, ...props },
  ref,
) {
  const { colorMode } = useFlowDiagramContext();
  const recentProps = Object.fromEntries(
    Object.entries(props).filter(
      ([key]) =>
        key !== "id" &&
        key !== "aria-describedby" &&
        !key.startsWith("data-") &&
        !/^on(Pointer|Mouse|Focus|Blur)/.test(key),
    ),
  );
  const remember = useRecentToolbarAction(
    <ToolbarTooltip
      label={props.title ?? props["aria-label"] ?? "Last used action"}
    >
      <ToolbarIconButton {...recentProps} icon={icon} />
    </ToolbarTooltip>,
    rememberAction && !!props.onClick,
  );
  return (
    <IconButton
      ref={ref}
      _hover={{ bg: colorMode === "dark" ? "whiteAlpha.100" : "blackAlpha.50" }}
      title={props.title ?? props["aria-label"]}
      {...props}
      onClick={(event) => {
        remember();
        props.onClick?.(event);
      }}
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
        variant="plain"
        bg="transparent"
        _hover={{ bg: "transparent", color: themeColor }}
        color={themeColor}
        focusRingColor={themeColor}
        {...props}
        aria-label={props["aria-label"] ?? "Close selection tools"}
        icon={<PiXLight size={20} aria-hidden="true" />}
      />
    </ToolbarTooltip>
  );
});
