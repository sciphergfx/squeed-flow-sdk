export const EDGE_TRACE_ANIMATION_STYLES = `.flow-sdk-edge-trace{pointer-events:none;animation:flow-sdk-edge-trace 2.4s linear infinite}.flow-sdk-edge-trace-reverse{animation-direction:reverse}@keyframes flow-sdk-edge-trace{from{stroke-dashoffset:18}to{stroke-dashoffset:-100}}@media(prefers-reduced-motion:reduce){.flow-sdk-edge-trace,.flow-sdk-edge-anim{animation:none}}`;

export function EdgeTraceAnimation({ path, color, width, reversed }: {
  path: string;
  color: string;
  width: number;
  reversed?: boolean;
}) {
  return <path className={`flow-sdk-edge-trace${reversed ? " flow-sdk-edge-trace-reverse" : ""}`}
    data-animation-variant="traveling" aria-hidden="true" pointerEvents="none"
    d={path} fill="none" stroke={color} strokeWidth={width}
    strokeLinecap="round" pathLength={100} strokeDasharray="18 100" />;
}