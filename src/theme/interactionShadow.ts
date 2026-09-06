import { keyframes } from "@emotion/react";

const hoverPulse = keyframes`
  0%, 100% { box-shadow: var(--flow-rest-shadow); }
  25%, 50% { box-shadow: var(--flow-hover-shadow); }
`;

export function getInteractionShadow(color: string, active = true, hoverSelector = "&:hover", animate = true) {
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
            animation: animate ? `${hoverPulse} 1200ms steps(10, end) 600ms` : "none",
          },
        },
      },
    },
  };
}