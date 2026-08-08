import ELK, { type ElkNode } from "elkjs";
import type { DiagramGraph, DiagramNode } from "@git-to-uml/graph";
import type { LayoutEdge, LayoutNode, LayoutResult } from "./types";
import type { BoxSize } from "./nodeSize";

const elk = new ELK();

const DEFAULT_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.nodeNodeBetweenLayers": "90",
  "elk.spacing.nodeNode": "70",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.edgeRouting": "ORTHOGONAL",
};

/**
 * Shared elkjs layered-layout runner behind both `layoutClassDiagram` and
 * `layoutArchitecture` — the two diagram types differ only in how a node's
 * box size is estimated (UML compartments vs. a plain folder label) and,
 * optionally, in elkjs layout options; the actual elkjs wiring (build
 * graph, run layout, map results back onto DiagramNode/DiagramEdgeView) is
 * identical, so it lives here once.
 */
export async function layoutGraph(
  graph: DiagramGraph,
  estimateSize: (node: DiagramNode) => BoxSize,
  layoutOptions: Record<string, string> = DEFAULT_LAYOUT_OPTIONS,
): Promise<LayoutResult> {
  const sizeById = new Map(graph.nodes.map((n) => [n.id, estimateSize(n)]));

  const elkGraph: ElkNode = {
    id: "root",
    layoutOptions,
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
    const points = section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : [];
    return { ...original, points };
  });

  return {
    nodes,
    edges,
    width: result.width ?? 0,
    height: result.height ?? 0,
  };
}
