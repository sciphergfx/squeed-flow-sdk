import type { CSSProperties, ReactNode } from "react";
import type { PortSide } from "../engine/types";

export interface FlowPortProps {
  id: string;
  role: "source" | "target";
  side?: PortSide;
  position?: number;
  children?: ReactNode;
  style?: CSSProperties;
}

export function FlowPort({
  id,
  role,
  side,
  position = 0.5,
  children,
  style,
}: FlowPortProps) {
  return (
    <div
      data-flow-property={id}
      data-flow-port-role={role}
      data-flow-port-side={side}
      data-flow-port-position={side ? position : undefined}
      style={{
        minHeight: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: role === "source" ? "flex-end" : "flex-start",
        ...style,
        ...(side ? { display: "none" } : {}),
      }}
    >
      {children ?? id}
    </div>
  );
}
