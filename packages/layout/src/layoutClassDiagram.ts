import type { DiagramGraph } from "@git-to-uml/graph";
import type { LayoutResult } from "./types";
import { estimateClassBoxSize } from "./nodeSize";
import { layoutGraph } from "./layoutGraph";

/**
 * Lays out a class-diagram DiagramGraph with elkjs's layered algorithm,
 * direction DOWN so inheritance arrows point up toward superclasses (UML
 * convention). elkjs (not dagre) is used for its orthogonal edge routing —
 * see the design plan for the full rationale.
 */
export async function layoutClassDiagram(graph: DiagramGraph): Promise<LayoutResult> {
  return layoutGraph(graph, estimateClassBoxSize);
}
