import { describe, expect, it } from "vitest";
import type { DiagramGraph } from "@git-to-uml/graph";
import { layoutArchitecture } from "./layoutArchitecture";

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function makeGraph(): DiagramGraph {
  const nodes = ["src/users", "src/posts", "src/shared", "."].map((dir) => ({
    id: dir,
    label: dir === "." ? "(root)" : dir,
    kind: "folder" as const,
    headerLines: [dir === "." ? "(root)" : dir],
  }));
  const edges = [
    { id: "e0", kind: "imports" as const, from: "src/posts", to: "src/users" },
    { id: "e1", kind: "imports" as const, from: "src/posts", to: "src/shared" },
    { id: "e2", kind: "imports" as const, from: ".", to: "src/posts" },
  ];
  return { nodes, edges };
}

describe("layoutArchitecture", () => {
  it("positions every folder box with no overlaps", async () => {
    const result = await layoutArchitecture(makeGraph());
    expect(result.nodes).toHaveLength(4);
    for (let i = 0; i < result.nodes.length; i++) {
      for (let j = i + 1; j < result.nodes.length; j++) {
        expect(boxesOverlap(result.nodes[i], result.nodes[j])).toBe(false);
      }
    }
  });

  it("routes every import edge with at least a start and end point", async () => {
    const result = await layoutArchitecture(makeGraph());
    expect(result.edges).toHaveLength(3);
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
    }
  });
});
