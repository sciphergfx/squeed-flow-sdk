import { DynamicIcon, type FlowDiagramNode } from "@squeed/flow-sdk";

export function SvgIconNode({ data }: FlowDiagramNode) {
  return (
    <svg width="240" height="160" data-svg-icon-node="" aria-label="SVG icon node">
      <DynamicIcon name={data.config?.icon} svg size={100} x={70} y={30} color="#dc2626" />
    </svg>
  );
}