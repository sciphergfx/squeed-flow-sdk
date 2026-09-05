import type { CSSProperties, ReactNode } from "react";

export interface FlowPortProps {
  id: string;
  role: "source" | "target";
  children?: ReactNode;
  style?: CSSProperties;
}

export function FlowPort({ id, role, children, style }: FlowPortProps) {
  return <div data-flow-property={id} data-flow-port-role={role}
    style={{ minHeight: 32, display: "flex", alignItems: "center", justifyContent: role === "source" ? "flex-end" : "flex-start", ...style }}>
    {children ?? id}
  </div>;
}