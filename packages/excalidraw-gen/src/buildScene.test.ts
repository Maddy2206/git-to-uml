import { describe, expect, it } from "vitest";
import type { LayoutResult } from "@git-to-uml/layout";
import { buildClassDiagramScene } from "./buildScene";

function makeLayout(): LayoutResult {
  return {
    width: 400,
    height: 300,
    nodes: [
      {
        id: "animal.ts#Animal",
        label: "Animal",
        kind: "class",
        headerLines: ["Animal"],
        compartments: { fields: ["# name: string"], methods: ["+ speak(): string"] },
        x: 0,
        y: 0,
        width: 200,
        height: 120,
      },
      {
        id: "dog.ts#Dog",
        label: "Dog",
        kind: "class",
        headerLines: ["Dog"],
        compartments: { fields: [], methods: [] },
        x: 0,
        y: 200,
        width: 200,
        height: 60,
      },
    ],
    edges: [
      {
        id: "edge-extends-0",
        kind: "extends",
        from: "dog.ts#Dog",
        to: "animal.ts#Animal",
        points: [
          { x: 100, y: 200 },
          { x: 100, y: 120 },
        ],
      },
    ],
  };
}

describe("buildClassDiagramScene", () => {
  it("produces a scene with unique element ids and bound arrow endpoints", () => {
    const scene = buildClassDiagramScene(makeLayout());

    expect(scene.type).toBe("excalidraw");
    const ids = scene.elements.map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    const rectIds = scene.elements.filter((el) => el.type === "rectangle").map((el) => el.id);
    expect(rectIds).toEqual(expect.arrayContaining(["animal.ts#Animal", "dog.ts#Dog"]));

    const arrow = scene.elements.find((el) => el.type === "arrow");
    expect(arrow).toBeDefined();
    expect((arrow as any).startBinding?.elementId).toBe("dog.ts#Dog");
    expect((arrow as any).endBinding?.elementId).toBe("animal.ts#Animal");
    expect((arrow as any).endArrowhead).toBe("triangle_outline");
  });

  it("groups each class box's rectangle/text/divider elements under one groupId", () => {
    const scene = buildClassDiagramScene(makeLayout());
    const animalElements = scene.elements.filter((el) => el.groupIds?.some((g) => g.startsWith("group-animal.ts#Animal-")));
    // rectangle + header + fields divider + fields text + methods divider + methods text
    expect(animalElements.length).toBeGreaterThanOrEqual(4);
  });
});
