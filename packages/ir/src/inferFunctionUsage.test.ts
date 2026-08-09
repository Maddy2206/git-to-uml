import { describe, expect, it } from "vitest";
import { inferFunctionUsage } from "./inferFunctionUsage";
import type { ClassIR, FunctionIR, ModuleIR } from "./types";

function makeFn(overrides: Partial<FunctionIR> & Pick<FunctionIR, "id" | "name" | "filePath">): FunctionIR {
  return {
    params: [],
    position: { file: overrides.filePath, startLine: 1, endLine: 5 },
    ...overrides,
  };
}

describe("inferFunctionUsage", () => {
  it("emits a 'calls' edge when a function references an identifier that's one of its file's resolved imports", () => {
    const headerFn = makeFn({ id: "Header.tsx#Header", name: "Header", filePath: "Header.tsx", role: "component" });
    const appFn = makeFn({
      id: "App.tsx#App",
      name: "App",
      filePath: "App.tsx",
      role: "component",
      usesNames: ["Header"],
    });

    const modules: Record<string, ModuleIR> = {
      "Header.tsx": { id: "Header.tsx", filePath: "Header.tsx", language: "typescript", imports: [], classes: [], functions: ["Header.tsx#Header"], loc: 3 },
      "App.tsx": {
        id: "App.tsx",
        filePath: "App.tsx",
        language: "typescript",
        imports: [{ from: "App.tsx", to: "Header.tsx", specifiers: ["Header"], resolved: true }],
        classes: [],
        functions: ["App.tsx#App"],
        loc: 6,
      },
    };

    const edges = inferFunctionUsage(
      { "Header.tsx#Header": headerFn, "App.tsx#App": appFn },
      modules,
    );

    expect(edges).toContainEqual(
      expect.objectContaining({ kind: "calls", from: "App.tsx#App", to: "Header.tsx#Header", label: "Header" }),
    );
  });

  it("resolves a used name against in-repo classes too, not just functions", () => {
    const serviceClass: ClassIR = {
      id: "service.ts#UserService",
      kind: "class",
      name: "UserService",
      filePath: "service.ts",
      fields: [],
      methods: [],
      position: { file: "service.ts", startLine: 1, endLine: 3 },
      language: "typescript",
    };
    const handlerFn = makeFn({
      id: "route.ts#GET",
      name: "GET",
      filePath: "route.ts",
      role: "handler",
      usesNames: ["UserService"],
    });

    const modules: Record<string, ModuleIR> = {
      "route.ts": {
        id: "route.ts",
        filePath: "route.ts",
        language: "typescript",
        imports: [{ from: "route.ts", to: "service.ts", specifiers: ["UserService"], resolved: true }],
        classes: [],
        functions: ["route.ts#GET"],
        loc: 4,
      },
    };

    const edges = inferFunctionUsage({ "route.ts#GET": handlerFn }, modules, { "service.ts#UserService": serviceClass });

    expect(edges).toContainEqual(
      expect.objectContaining({ kind: "calls", from: "route.ts#GET", to: "service.ts#UserService" }),
    );
  });

  it("does not emit an edge when the used name isn't actually imported (unresolved import, or unrelated identifier)", () => {
    const appFn = makeFn({
      id: "App.tsx#App",
      name: "App",
      filePath: "App.tsx",
      usesNames: ["someExternalLib"],
    });
    const modules: Record<string, ModuleIR> = {
      "App.tsx": {
        id: "App.tsx",
        filePath: "App.tsx",
        language: "typescript",
        imports: [{ from: "App.tsx", to: "some-external-lib", specifiers: ["someExternalLib"], resolved: false }],
        classes: [],
        functions: ["App.tsx#App"],
        loc: 4,
      },
    };

    expect(inferFunctionUsage({ "App.tsx#App": appFn }, modules)).toEqual([]);
  });
});
