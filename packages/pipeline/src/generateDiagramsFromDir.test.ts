import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateDiagramsFromDir } from "./generateDiagramsFromDir";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/shapes");

describe("generateDiagramsFromDir (end-to-end, network-free)", () => {
  it("runs the full parse -> IR -> graph -> layout -> Excalidraw-scene pipeline against a fixture repo", async () => {
    const result = await generateDiagramsFromDir(fixturesDir, {
      repoUrl: "fixture/shapes",
      commitSha: "0000000",
    });

    expect(result.stats.fileCount).toBe(3);
    expect(result.stats.classCount).toBe(3); // Shape, Circle, Square
    expect(result.stats.edgeCount).toBeGreaterThanOrEqual(2); // Circle->Shape, Square->Shape extends edges

    const scene = result.classDiagram;
    expect(scene.type).toBe("excalidraw");
    const rectangles = scene.elements.filter((el) => el.type === "rectangle");
    expect(rectangles.map((r) => r.id).sort()).toEqual(["circle.ts#Circle", "shape.ts#Shape", "square.ts#Square"]);

    const arrows = scene.elements.filter((el) => el.type === "arrow");
    expect(arrows.length).toBeGreaterThanOrEqual(2);
    for (const arrow of arrows as any[]) {
      expect(arrow.endArrowhead).toBe("triangle_outline");
    }

    // No two class boxes should overlap.
    for (let i = 0; i < rectangles.length; i++) {
      for (let j = i + 1; j < rectangles.length; j++) {
        const a = rectangles[i] as any;
        const b = rectangles[j] as any;
        const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlap).toBe(false);
      }
    }
  });
});
