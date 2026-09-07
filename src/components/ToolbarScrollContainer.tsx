import { Box } from "@chakra-ui/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getInteractionSurface } from "../theme/interactionShadow";

export function ToolbarScrollContainer({
  children,
  background,
  border,
}: {
  children: ReactNode;
  background: string;
  border: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState({ left: false, right: false });
  useLayoutEffect(() => {
    const element = scrollRef.current!;
    const update = () => {
      const left = element.scrollLeft > 1;
      const right =
        element.scrollWidth - element.clientWidth - element.scrollLeft > 1;
      setHidden((previous) =>
        previous.left === left && previous.right === right
          ? previous
          : { left, right },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
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
            [side]: 0,
            opacity: hidden[side] ? 1 : 0,
            background: `linear-gradient(to ${side === "left" ? "right" : "left"}, ${color}, transparent)`,
          }}
        />
      ))}
    </Box>
  );
}
