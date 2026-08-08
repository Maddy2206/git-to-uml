import type { DiagramGraph } from "@git-to-uml/graph";
import type { LayoutResult } from "./types";
import { estimateClassBoxSize } from "./nodeSize";
import { layoutGraph } from "./layoutGraph";

/**
 * Architecture-diagram layout: the same layered elkjs algorithm as the
 * class diagram (see layoutGraph.ts). Component boxes carry a compartment
 * of representative class/entity names (see architectureGraph.ts), so
 * sizing uses the same compartment-aware estimate as the class diagram —
 * a component with no listed classes sizes down to just its header, same
 * as before. Direction DOWN still reads fine for a dependency graph —
 * there's no UML-specific convention to respect here the way there is for
 * inheritance arrows pointing to a superclass.
 */
export async function layoutArchitecture(graph: DiagramGraph): Promise<LayoutResult> {
  return layoutGraph(graph, estimateClassBoxSize);
}
