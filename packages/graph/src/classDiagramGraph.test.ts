import { describe, expect, it } from "vitest";
import type { RepoIR } from "@git-to-uml/ir";
import { buildClassDiagramGraph } from "./classDiagramGraph";

function makeRepo(): RepoIR {
  return {
    repoUrl: "test/repo",
    commitSha: "abc",
    modules: {},
    functions: {},
    classes: {
      "animal.ts#Animal": {
        id: "animal.ts#Animal",
        kind: "class",
        name: "Animal",
        filePath: "animal.ts",
        fields: [{ id: "f1", name: "name", type: "string", visibility: "protected", position: { file: "animal.ts", startLine: 1, endLine: 1 } }],
        methods: [],
        position: { file: "animal.ts", startLine: 1, endLine: 10 },
        language: "typescript",
      },
      "dog.ts#Dog": {
        id: "dog.ts#Dog",
        kind: "class",
        name: "Dog",
        filePath: "dog.ts",
        fields: [],
        methods: [],
        extends: ["Animal"],
        position: { file: "dog.ts", startLine: 1, endLine: 10 },
        language: "typescript",
      },
    },
    edges: [{ id: "e1", kind: "extends", from: "dog.ts#Dog", to: "animal.ts#Animal" }],
  };
}

describe("buildClassDiagramGraph", () => {
  it("builds nodes with formatted compartments and includes extends edges", () => {
    const graph = buildClassDiagramGraph(makeRepo());
    expect(graph.nodes).toHaveLength(2);
    const animal = graph.nodes.find((n) => n.id === "animal.ts#Animal")!;
    expect(animal.compartments?.fields).toEqual(["# name: string"]);
    expect(graph.edges).toEqual([{ id: "e1", kind: "extends", from: "dog.ts#Dog", to: "animal.ts#Animal", label: undefined }]);
  });

  it("scopes to a folder prefix when requested", () => {
    const repo = makeRepo();
    repo.classes["other/widget.ts#Widget"] = {
      id: "other/widget.ts#Widget",
      kind: "class",
      name: "Widget",
      filePath: "other/widget.ts",
      fields: [],
      methods: [],
      position: { file: "other/widget.ts", startLine: 1, endLine: 1 },
      language: "typescript",
    };
    const graph = buildClassDiagramGraph(repo, { scopeToFolder: "other/" });
    expect(graph.nodes.map((n) => n.id)).toEqual(["other/widget.ts#Widget"]);
  });
});
