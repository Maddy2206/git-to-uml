import ELK, { type ElkNode } from "elkjs";
import type { DiagramGraph } from "@git-to-uml/graph";
import type { LayoutEdge, LayoutNode, LayoutResult } from "./types";
import { estimateClassBoxSize } from "./nodeSize";

const elk = new ELK();

/**
 * Lays out a class-diagram DiagramGraph with elkjs's layered algorithm,
 * direction DOWN so inheritance arrows point up toward superclasses (UML
 * convention). elkjs (not dagre) is used for its orthogonal edge routing —
 * see the design plan for the full rationale.
 */
export async function layoutClassDiagram(graph: DiagramGraph): Promise<LayoutResult> {
  const sizeById = new Map(graph.nodes.map((n) => [n.id, estimateClassBoxSize(n)]));

  const elkGraph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
      "elk.spacing.nodeNode": "70",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: graph.nodes.map((n) => {
      const size = sizeById.get(n.id)!;
      return { id: n.id, width: size.width, height: size.height };
    }),
    edges: graph.edges.map((e) => ({
      id: e.id,
      sources: [e.from],
      targets: [e.to],
    })),
  };

  const result = await elk.layout(elkGraph);

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodes: LayoutNode[] = (result.children ?? []).map((child) => ({
    ...nodeById.get(child.id!)!,
    x: child.x ?? 0,
    y: child.y ?? 0,
    width: child.width ?? 0,
    height: child.height ?? 0,
  }));

  const edgeById = new Map(graph.edges.map((e) => [e.id, e]));
  const edges: LayoutEdge[] = (result.edges ?? []).map((elkEdge) => {
    const original = edgeById.get(elkEdge.id!)!;
    const section = elkEdge.sections?.[0];
    const points = section
      ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
      : [];
    return { ...original, points };
  });

  return {
    nodes,
    edges,
    width: result.width ?? 0,
    height: result.height ?? 0,
  };
}
