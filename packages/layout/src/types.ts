import type { DiagramEdgeView, DiagramNode } from "@git-to-uml/graph";

export interface LayoutNode extends DiagramNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutEdge extends DiagramEdgeView {
  points: LayoutPoint[];
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}
