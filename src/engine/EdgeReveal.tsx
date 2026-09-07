import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const EDGE_REVEAL_STYLES = `.flow-sdk-edge-reveal{animation:flow-sdk-edge-reveal var(--flow-edge-reveal-duration,600ms) linear both;animation-play-state:var(--flow-edge-reveal-state,running)}.flow-sdk-edge-reveal-end{animation:flow-sdk-edge-reveal-end var(--flow-edge-reveal-duration,600ms) steps(1,end) both;animation-play-state:var(--flow-edge-reveal-state,running)}@keyframes flow-sdk-edge-reveal{from{stroke-dashoffset:var(--flow-edge-reveal-from,100)}to{stroke-dashoffset:0}}@keyframes flow-sdk-edge-reveal-end{from{opacity:0}to{opacity:1}}@media(prefers-reduced-motion:reduce){.flow-sdk-edge-reveal{animation:none;stroke-dashoffset:0}.flow-sdk-edge-reveal-end{animation:none;opacity:1}}`;

export function EdgeReveal({ path, width, reversed, children, onComplete }: {
  path: string;
  width: number;
  reversed?: boolean;
  children: ReactNode;
  onComplete?: () => void;
}) {
  const id = `flow-edge-reveal-${useId().replace(/:/g, "")}`;
  const stroke = useRef<SVGPathElement>(null);
  const [bounds, setBounds] = useState({ x: 0, y: 0, width: 1, height: 1 });
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => { if (motion.matches) onComplete?.(); };
    finish();
    motion.addEventListener("change", finish);
    return () => motion.removeEventListener("change", finish);
  }, [onComplete]);
  useLayoutEffect(() => {
    const box = stroke.current?.getBBox();
    if (box) setBounds({ x: box.x - width, y: box.y - width, width: box.width + width * 2, height: box.height + width * 2 });
  }, [path, width]);
  return (
    <>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" {...bounds}>
          <path
            ref={stroke}
            className="flow-sdk-edge-reveal"
            onAnimationEnd={(event) => { if (event.animationName === "flow-sdk-edge-reveal") onComplete?.(); }}
            data-reveal-direction={reversed ? "reverse" : "forward"}
            style={{ "--flow-edge-reveal-from": reversed ? -100 : 100 } as React.CSSProperties}
            d={path}
            fill="none"
            stroke="white"
            strokeWidth={width}
            strokeLinecap="butt"
            strokeLinejoin="round"
            pathLength={100}
            strokeDasharray="100 100"
          />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>{children}</g>
    </>
  );
}