import type { FlowDiagramEdge, FlowDirection } from "./index";
import type { Box, Point } from "../engine/types";

export type BuiltInEdgeType = "straight" | "bezier" | "orthogonal" | "rounded-orthogonal";

export interface CustomEdgeGeometry {
  d: string;
  arrow?: string;
  label: { x: number; y: number; angle: number };
}

export interface CustomEdgeContext {
  edge: FlowDiagramEdge["data"];
  source: Box;
  target: Box;
  sourcePoint: Point;
  targetPoint: Point;
  direction: FlowDirection;
  sourceY?: number;
  targetY?: number;
  inverted: boolean;
  defaultGeometry: CustomEdgeGeometry;
}

export type CustomEdgeFactory = (context: CustomEdgeContext) => CustomEdgeGeometry | null;