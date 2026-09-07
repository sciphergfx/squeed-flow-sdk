import { keyframes } from "@emotion/react";

const hoverPulse = keyframes`
  0%, 100% { box-shadow: var(--flow-rest-shadow); }
  25%, 50% { box-shadow: var(--flow-hover-shadow); }
`;

const hoverReveal = keyframes`
  from { box-shadow: var(--flow-start-shadow); }
  to { box-shadow: var(--flow-rest-shadow); }
`;

export function getInteractionShadow(
  color: string,
  active = true,
  hoverSelector = "&:hover",
  animate = true,
) {
  const tint = `color-mix(in srgb, ${color} 60%, transparent)`;
  const spread = active ? 8 : 0;
  const shadow = `0 0 0 ${spread}px ${tint}`;
  const hoverShadow = `0 0 0 8px ${tint}`;
  return {
    boxShadow: shadow,
    css: {
      "--flow-rest-shadow": hoverShadow,
      "--flow-hover-shadow": `0 0 0 18px ${tint}`,
      "@media (hover: hover)": {
        [hoverSelector]: {
          boxShadow: hoverShadow,
          "@media (prefers-reduced-motion: no-preference)": {
            animation: animate
              ? `${hoverPulse} 1200ms steps(10, end) 600ms`
              : "none",
          },
        },
      },
    },
  };
}

/** Flat chrome surface: the border and halo only appear while hovered. Colors are CSS values. */
export function getInteractionSurface(surface: string, border: string) {
  const { boxShadow, css } = getInteractionShadow(surface, false);
  const hover = css["@media (hover: hover)"]["&:hover"];
  return {
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
    boxShadow,
    ...css,
    "--flow-start-shadow": boxShadow,
    "@media (hover: hover)": {
      "&:hover": {
        ...hover,
        borderColor: border,
        // Steps the halo up from flat to the default 8px and stops there; no pulse past it.
        "@media (prefers-reduced-motion: no-preference)": {
          animation: `${hoverReveal} 600ms steps(5, end)`,
        },
      },
    },
  };
}
