import { describe, expect, it } from "vitest";
import type { DiagramGraph } from "@git-to-uml/graph";
import { layoutClassDiagram } from "./layoutClassDiagram";

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function makeGraph(nodeCount: number): DiagramGraph {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    label: `Class${i}`,
    kind: "class" as const,
    headerLines: [`Class${i}`],
    compartments: { fields: [`- field${i}: string`], methods: [`+ method${i}(): void`] },
  }));
  const edges = nodes.slice(1).map((n, i) => ({
    id: `e${i}`,
    kind: "extends" as const,
    from: n.id,
    to: nodes[i].id,
  }));
  return { nodes, edges };
}

describe("layoutClassDiagram", () => {
  it("positions every node with no overlapping bounding boxes", async () => {
    const graph = makeGraph(8);
    const result = await layoutClassDiagram(graph);

    expect(result.nodes).toHaveLength(8);
    for (let i = 0; i < result.nodes.length; i++) {
      for (let j = i + 1; j < result.nodes.length; j++) {
        expect(boxesOverlap(result.nodes[i], result.nodes[j])).toBe(false);
      }
    }
  });

  it("produces edge routes (points) connecting laid-out nodes", async () => {
    const graph = makeGraph(3);
    const result = await layoutClassDiagram(graph);
    expect(result.edges).toHaveLength(2);
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
    }
  });
});
