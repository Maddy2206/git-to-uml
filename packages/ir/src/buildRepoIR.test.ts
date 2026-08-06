import { describe, expect, it } from "vitest";
import { buildRepoIR } from "./buildRepoIR";
import type { ClassIR, ParsedFile } from "./types";

function makeClass(overrides: Partial<ClassIR> & Pick<ClassIR, "id" | "name" | "filePath">): ClassIR {
  return {
    kind: "class",
    fields: [],
    methods: [],
    position: { file: overrides.filePath, startLine: 1, endLine: 10 },
    language: "typescript",
    ...overrides,
  };
}

describe("buildRepoIR", () => {
  it("merges modules/classes/functions and resolves in-repo inheritance", () => {
    const animalFile: ParsedFile = {
      module: { id: "animal.ts", filePath: "animal.ts", language: "typescript", imports: [], classes: ["animal.ts#Animal"], functions: [], loc: 5 },
      classes: [makeClass({ id: "animal.ts#Animal", name: "Animal", filePath: "animal.ts" })],
      functions: [],
    };
    const dogFile: ParsedFile = {
      module: {
        id: "dog.ts",
        filePath: "dog.ts",
        language: "typescript",
        imports: [{ from: "dog.ts", to: "animal.ts", specifiers: ["Animal"], resolved: true }],
        classes: ["dog.ts#Dog"],
        functions: [],
        loc: 5,
      },
      classes: [makeClass({ id: "dog.ts#Dog", name: "Dog", filePath: "dog.ts", extends: ["Animal"] })],
      functions: [],
    };

    const repo = buildRepoIR({ repoUrl: "test/repo", commitSha: "abc123", files: [animalFile, dogFile] });

    expect(Object.keys(repo.classes)).toEqual(["animal.ts#Animal", "dog.ts#Dog"]);
    const extendsEdge = repo.edges.find((e) => e.kind === "extends");
    expect(extendsEdge).toMatchObject({ from: "dog.ts#Dog", to: "animal.ts#Animal" });
    const importEdge = repo.edges.find((e) => e.kind === "imports");
    expect(importEdge).toMatchObject({ from: "dog.ts", to: "animal.ts" });
  });

  it("synthesizes an external placeholder class for unresolved base classes", () => {
    const file: ParsedFile = {
      module: { id: "widget.ts", filePath: "widget.ts", language: "typescript", imports: [], classes: ["widget.ts#Widget"], functions: [], loc: 5 },
      classes: [makeClass({ id: "widget.ts#Widget", name: "Widget", filePath: "widget.ts", extends: ["ExternalBase"] })],
      functions: [],
    };

    const repo = buildRepoIR({ repoUrl: "test/repo", commitSha: "abc123", files: [file] });

    expect(repo.classes["external#ExternalBase"]).toBeDefined();
    const extendsEdge = repo.edges.find((e) => e.kind === "extends");
    expect(extendsEdge).toMatchObject({ from: "widget.ts#Widget", to: "external#ExternalBase" });
  });

  it("infers composition edges from field types matching in-repo classes", () => {
    const engineFile: ParsedFile = {
      module: { id: "engine.ts", filePath: "engine.ts", language: "typescript", imports: [], classes: ["engine.ts#Engine"], functions: [], loc: 5 },
      classes: [makeClass({ id: "engine.ts#Engine", name: "Engine", filePath: "engine.ts" })],
      functions: [],
    };
    const carFile: ParsedFile = {
      module: { id: "car.ts", filePath: "car.ts", language: "typescript", imports: [], classes: ["car.ts#Car"], functions: [], loc: 5 },
      classes: [
        makeClass({
          id: "car.ts#Car",
          name: "Car",
          filePath: "car.ts",
          fields: [{ id: "car.ts#Car.engine", name: "engine", type: "Engine", visibility: "private", position: { file: "car.ts", startLine: 2, endLine: 2 } }],
        }),
      ],
      functions: [],
    };

    const repo = buildRepoIR({ repoUrl: "test/repo", commitSha: "abc123", files: [engineFile, carFile] });

    const composesEdge = repo.edges.find((e) => e.kind === "composes");
    expect(composesEdge).toMatchObject({ from: "car.ts#Car", to: "engine.ts#Engine", label: "engine" });
  });
});
