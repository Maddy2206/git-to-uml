import { describe, expect, it } from "vitest";
import type { ClassIR, RepoIR } from "@git-to-uml/ir";
import { buildArchitectureGraph } from "./architectureGraph";

function makeClass(overrides: Partial<ClassIR> & Pick<ClassIR, "id" | "name" | "filePath">): ClassIR {
  return {
    kind: "class",
    fields: [],
    methods: [],
    position: { file: overrides.filePath, startLine: 1, endLine: 1 },
    language: "typescript",
    ...overrides,
  };
}

function makeRepo(): RepoIR {
  return {
    repoUrl: "test/repo",
    commitSha: "abc",
    functions: {},
    modules: {
      "src/api/userController.ts": {
        id: "src/api/userController.ts",
        filePath: "src/api/userController.ts",
        language: "typescript",
        imports: [{ from: "src/api/userController.ts", to: "src/models/user.ts", specifiers: ["User"], resolved: true }],
        classes: ["src/api/userController.ts#UserController"],
        functions: [],
        loc: 5,
      },
      "src/models/user.ts": {
        id: "src/models/user.ts",
        filePath: "src/models/user.ts",
        language: "typescript",
        imports: [],
        classes: ["src/models/user.ts#User"],
        functions: [],
        loc: 5,
      },
      "src/models/post.ts": {
        id: "src/models/post.ts",
        filePath: "src/models/post.ts",
        language: "typescript",
        // Same-category import (models -> models) — should be dropped as noise.
        imports: [{ from: "src/models/post.ts", to: "src/models/user.ts", specifiers: ["User"], resolved: true }],
        classes: ["src/models/post.ts#Post"],
        functions: [],
        loc: 5,
      },
    },
    classes: {
      "src/api/userController.ts#UserController": makeClass({
        id: "src/api/userController.ts#UserController",
        name: "UserController",
        filePath: "src/api/userController.ts",
      }),
      "src/models/user.ts#User": makeClass({ id: "src/models/user.ts#User", name: "User", filePath: "src/models/user.ts" }),
      "src/models/post.ts#Post": makeClass({ id: "src/models/post.ts#Post", name: "Post", filePath: "src/models/post.ts" }),
    },
    edges: [
      { id: "e1", kind: "imports", from: "src/api/userController.ts", to: "src/models/user.ts" },
      { id: "e2", kind: "imports", from: "src/models/post.ts", to: "src/models/user.ts" },
    ],
  };
}

describe("buildArchitectureGraph", () => {
  it("groups modules into logical components (API/Database) rather than one box per directory", () => {
    const graph = buildArchitectureGraph(makeRepo());
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["api", "database"]);
    const api = graph.nodes.find((n) => n.id === "api")!;
    expect(api.label).toBe("API Gateway");
    const database = graph.nodes.find((n) => n.id === "database")!;
    expect(database.label).toBe("Database");
  });

  it("lists the component's classes/entities as a compartment", () => {
    const graph = buildArchitectureGraph(makeRepo());
    const database = graph.nodes.find((n) => n.id === "database")!;
    expect(database.compartments?.fields).toEqual(["Post", "User"]);
    const api = graph.nodes.find((n) => n.id === "api")!;
    expect(api.compartments?.fields).toEqual(["UserController"]);
  });

  it("aggregates cross-component imports and drops same-component ones", () => {
    const graph = buildArchitectureGraph(makeRepo());
    expect(graph.edges).toEqual([{ id: "arch-edge-0", kind: "imports", from: "api", to: "database", label: undefined }]);
  });
});
