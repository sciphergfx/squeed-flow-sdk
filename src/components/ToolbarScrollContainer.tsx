import { Box } from "@chakra-ui/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getInteractionSurface } from "../theme/interactionShadow";

export function ToolbarScrollContainer({
  children,
  background,
  border,
  endElement,
}: {
  children: ReactNode;
  background: string;
  border: string;
  endElement?: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState({ left: false, right: false });
  useLayoutEffect(() => {
    const element = scrollRef.current!;
    let previousWidth = element.parentElement!.offsetWidth;
    const update = () => {
      const width = element.parentElement!.offsetWidth;
      if (width > 0 && width !== previousWidth) { const scale = previousWidth / width; previousWidth = width; if (scale > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) element.parentElement!.animate({ transform: [`scaleX(${scale})`, "scaleX(1)"], transformOrigin: [endElement ? "right center" : "left center", endElement ? "right center" : "left center"] }, { duration: 180, easing: "ease-out", id: "flow-toolbar-grow" }); }
      const left = element.scrollLeft > 1;
      const right =
        element.scrollWidth - element.clientWidth - element.scrollLeft > 1;
      setHidden((previous) =>
        previous.left === left && previous.right === right
          ? previous
          : { left, right },
      );
    };
    const onWheel = (event: WheelEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.deltaX !== 0 ||
        !event.deltaY ||
        element.scrollWidth <= element.clientWidth
      )
        return;
      event.preventDefault();
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? element.clientWidth
            : 1;
      element.scrollLeft += event.deltaY * unit;
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: false });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
      element.removeEventListener("wheel", onWheel);
    };
  }, []);
  const color = `var(--chakra-colors-${background.replace(".", "-")})`;
  return (
    <Box
      position="relative"
      bg={background}
      minW={0}
      maxW="100%"
      flex="0 1 auto"
      borderRadius="30px"
      css={getInteractionSurface(
        color,
        `var(--chakra-colors-${border.replace(".", "-")})`,
      )}
    >
      <Box
        ref={scrollRef}
        data-flow-toolbar-scroll=""
        h={50}
        minH={50}
        alignContent="center"
        overflowX="auto"
        overflowY="hidden"
        mr={endElement ? "44px" : undefined}
        borderRadius="inherit"
        css={{
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {children}
      </Box>
      {(["left", "right"] as const).map((side) => (
        <Box
          key={side}
          data-flow-toolbar-fade={side}
          aria-hidden="true"
          position="absolute"
          top={0}
          bottom={0}
          w="20px"
          pointerEvents="none"
          borderRadius={side === "left" ? "30px 0 0 30px" : "0 30px 30px 0"}
          style={{
            [side]: side === "right" && endElement ? 44 : 0,
            opacity: hidden[side] ? 1 : 0,
            background: `linear-gradient(to ${side === "left" ? "right" : "left"}, ${color}, transparent)`,
          }}
        />
      ))}
      {endElement && (
        <Box
          position="absolute"
          right="6px"
          top={0}
          h="50px"
          w="32px"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {endElement}
        </Box>
      )}
    </Box>
  );
}
