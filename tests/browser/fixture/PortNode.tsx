import { FlowPort } from "@squeed/flow-sdk";

export function PortNode({ data }: { data: { id: string; label?: string } }) {
  return <div style={{ width: 300, padding: 24, background: "#f4f4f5", color: "#18181b", border: "2px solid #71717a" }}>
    <strong>{data.label}</strong>
    {data.id === "alpha" ? <>
      <FlowPort id="true" role="source">True</FlowPort>
      <FlowPort id="false" role="source">False</FlowPort>
    </> : <FlowPort id="input" role="target">Input</FlowPort>}
  </div>;
}