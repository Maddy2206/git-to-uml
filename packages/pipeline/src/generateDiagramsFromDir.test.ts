import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateDiagramsFromDir } from "./generateDiagramsFromDir";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/shapes");
const nestedFixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/nested");
const mixedFixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/mixed");

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

    // None of the fixture files match any component-classification signal
    // (no models/api/service/... naming), so they all fall back to the
    // single "application" component — one box, no edges.
    expect(result.stats.componentCount).toBe(1);
    const archScene = result.architectureDiagram;
    expect(archScene.type).toBe("excalidraw");
    const archRects = archScene.elements.filter((el) => el.type === "rectangle");
    expect(archRects.map((r) => r.id)).toEqual(["application"]);
    expect(archScene.elements.filter((el) => el.type === "arrow")).toHaveLength(0);
  });

  it("groups files into logical components (API/Database) and aggregates the cross-component import", async () => {
    const result = await generateDiagramsFromDir(nestedFixturesDir, {
      repoUrl: "fixture/nested",
      commitSha: "0000000",
    });

    expect(result.stats.componentCount).toBe(2);
    const archScene = result.architectureDiagram;
    const rectIds = archScene.elements.filter((el) => el.type === "rectangle").map((el) => el.id);
    expect(rectIds.sort()).toEqual(["api", "database"]);

    const arrows = archScene.elements.filter((el) => el.type === "arrow") as any[];
    expect(arrows).toHaveLength(1);
    expect(arrows[0].startBinding?.elementId).toBe("api");
    expect(arrows[0].endBinding?.elementId).toBe("database");
    expect(arrows[0]).toMatchObject({ strokeStyle: "dashed", endArrowhead: "arrow" });

    // The Database box lists its entity, and the API box its controller —
    // real information, not just a bare label (see architectureGraph.ts).
    const dbFieldsText = archScene.elements.find((el) => el.id === "database-fields") as any;
    expect(dbFieldsText?.text).toContain("User");
  });

  it("parses a mixed TS/Python/Java repo into one merged class diagram", async () => {
    const result = await generateDiagramsFromDir(mixedFixturesDir, {
      repoUrl: "fixture/mixed",
      commitSha: "0000000",
    });

    expect(result.stats.fileCount).toBe(3);
    expect(result.stats.classCount).toBe(3);

    const rectIds = result.classDiagram.elements.filter((el) => el.type === "rectangle").map((el) => el.id);
    expect(rectIds.sort()).toEqual(["Service.java#Service", "app.ts#Greeter", "helper.py#Helper"]);
  });
});
