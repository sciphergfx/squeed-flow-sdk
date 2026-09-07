import type { CSSProperties, ReactNode } from "react";
import type { PortSide } from "../engine/types";

export interface FlowPortProps {
  id: string;
  label?: string;
  role: "source" | "target";
  side?: PortSide;
  position?: number;
  placement?: "config";
  children?: ReactNode;
  style?: CSSProperties;
}

export function FlowPort({
  id,
  label,
  role,
  side,
  position = 0.5,
  placement,
  children,
  style,
}: FlowPortProps) {
  return (
    <div
      data-flow-property={id}
      data-flow-port-role={role}
      data-flow-port-side={side}
      data-flow-port-position={side ? position : undefined}
      data-flow-port-placement={placement}
      style={{
        minHeight: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: role === "source" ? "flex-end" : "flex-start",
        ...style,
        ...(side ? { display: "none" } : {}),
      }}
    >
      {children ?? label ?? id}
    </div>
  );
}
