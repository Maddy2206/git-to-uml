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

  it("builds nodes for functions/components/hooks/route-handlers, styled by role, and renders 'calls' edges", () => {
    const repo = makeRepo();
    repo.functions = {
      "Header.tsx#Header": {
        id: "Header.tsx#Header",
        name: "Header",
        params: [],
        filePath: "Header.tsx",
        role: "component",
        position: { file: "Header.tsx", startLine: 1, endLine: 3 },
      },
      "App.tsx#App": {
        id: "App.tsx#App",
        name: "App",
        params: [],
        filePath: "App.tsx",
        role: "component",
        position: { file: "App.tsx", startLine: 1, endLine: 6 },
      },
      "useCounter.ts#useCounter": {
        id: "useCounter.ts#useCounter",
        name: "useCounter",
        params: [],
        returnType: "number",
        filePath: "useCounter.ts",
        role: "hook",
        position: { file: "useCounter.ts", startLine: 1, endLine: 3 },
      },
      "route.ts#GET": {
        id: "route.ts#GET",
        name: "GET",
        params: [],
        filePath: "route.ts",
        role: "handler",
        position: { file: "route.ts", startLine: 1, endLine: 3 },
      },
      "helpers.ts#add": {
        id: "helpers.ts#add",
        name: "add",
        params: [{ name: "a", type: "number" }, { name: "b", type: "number" }],
        returnType: "number",
        filePath: "helpers.ts",
        position: { file: "helpers.ts", startLine: 1, endLine: 3 },
      },
    };
    repo.edges.push({ id: "e-calls", kind: "calls", from: "App.tsx#App", to: "Header.tsx#Header", label: "Header" });

    const graph = buildClassDiagramGraph(repo);

    const header = graph.nodes.find((n) => n.id === "Header.tsx#Header")!;
    expect(header.kind).toBe("component");
    expect(header.headerLines).toEqual(["«component»", "Header"]);

    const hook = graph.nodes.find((n) => n.id === "useCounter.ts#useCounter")!;
    expect(hook.kind).toBe("hook");
    expect(hook.headerLines).toEqual(["«hook»", "useCounter"]);
    expect(hook.compartments?.methods).toEqual(["(): number"]);

    const handler = graph.nodes.find((n) => n.id === "route.ts#GET")!;
    expect(handler.kind).toBe("handler");
    expect(handler.headerLines).toEqual(["«api route»", "GET"]);

    const plain = graph.nodes.find((n) => n.id === "helpers.ts#add")!;
    expect(plain.kind).toBe("function");
    expect(plain.headerLines).toEqual(["add"]); // no stereotype for a plain function
    expect(plain.compartments?.methods).toEqual(["(a: number, b: number): number"]);

    expect(graph.edges).toContainEqual({ id: "e-calls", kind: "calls", from: "App.tsx#App", to: "Header.tsx#Header", label: "Header" });
  });
});
