import { describe, expect, it } from "vitest";
import { inferComposition } from "./inferComposition";
import type { ClassIR } from "./types";

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

describe("inferComposition", () => {
  it("resolves the inner type of a wrapper generic, not the wrapper name itself", () => {
    // Naively taking the text before `<` on "Promise<User>" yields "Promise",
    // silently losing "User" — this is the bug the token-based resolver fixes.
    const classes: Record<string, ClassIR> = {
      "user.ts#User": makeClass({ id: "user.ts#User", name: "User", filePath: "user.ts" }),
      "repo.ts#UserRepo": makeClass({
        id: "repo.ts#UserRepo",
        name: "UserRepo",
        filePath: "repo.ts",
        methods: [
          {
            id: "repo.ts#UserRepo.find",
            name: "find",
            params: [],
            returnType: "Promise<User>",
            visibility: "public",
            position: { file: "repo.ts", startLine: 2, endLine: 2 },
          },
        ],
      }),
    };

    const edges = inferComposition(classes);
    expect(edges).toContainEqual(
      expect.objectContaining({ kind: "aggregates", from: "repo.ts#UserRepo", to: "user.ts#User" }),
    );
  });

  it("resolves a union-with-undefined field type", () => {
    const classes: Record<string, ClassIR> = {
      "engine.ts#Engine": makeClass({ id: "engine.ts#Engine", name: "Engine", filePath: "engine.ts" }),
      "car.ts#Car": makeClass({
        id: "car.ts#Car",
        name: "Car",
        filePath: "car.ts",
        fields: [
          {
            id: "car.ts#Car.engine",
            name: "engine",
            type: "Engine | undefined",
            visibility: "private",
            position: { file: "car.ts", startLine: 2, endLine: 2 },
          },
        ],
      }),
    };

    const edges = inferComposition(classes);
    expect(edges).toContainEqual(expect.objectContaining({ kind: "composes", from: "car.ts#Car", to: "engine.ts#Engine" }));
  });

  it("does not self-reference when a method returns its own class", () => {
    const classes: Record<string, ClassIR> = {
      "builder.ts#Builder": makeClass({
        id: "builder.ts#Builder",
        name: "Builder",
        filePath: "builder.ts",
        methods: [
          {
            id: "builder.ts#Builder.self",
            name: "withX",
            params: [],
            returnType: "Builder",
            visibility: "public",
            position: { file: "builder.ts", startLine: 2, endLine: 2 },
          },
        ],
      }),
    };

    expect(inferComposition(classes)).toEqual([]);
  });
});
