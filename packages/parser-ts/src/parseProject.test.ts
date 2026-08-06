import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildRepoIR } from "@git-to-uml/ir";
import { parseTypeScriptProject } from "./parseProject";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");

describe("parseTypeScriptProject", () => {
  it("extracts classes, interfaces, inheritance, and imports from fixture files", () => {
    const files = parseTypeScriptProject(fixturesDir);
    const repo = buildRepoIR({ repoUrl: "fixture/repo", commitSha: "0", files });

    const dog = repo.classes["dog.ts#Dog"];
    expect(dog).toBeDefined();
    expect(dog.extends).toEqual(["Animal"]);
    expect(dog.implements).toEqual(["Feedable"]);
    expect(dog.fields.map((f) => f.name)).toContain("breed");
    expect(dog.methods.map((m) => m.name)).toEqual(expect.arrayContaining(["speak", "feed"]));

    const animal = repo.classes["animal.ts#Animal"];
    expect(animal).toBeDefined();
    expect(animal.isAbstract).toBe(true);

    const feedable = repo.classes["animal.ts#Feedable"];
    expect(feedable).toBeDefined();
    expect(feedable.kind).toBe("interface");

    const extendsEdge = repo.edges.find((e) => e.kind === "extends");
    expect(extendsEdge).toMatchObject({ from: "dog.ts#Dog", to: "animal.ts#Animal" });
    const implementsEdge = repo.edges.find((e) => e.kind === "implements");
    expect(implementsEdge).toMatchObject({ from: "dog.ts#Dog", to: "animal.ts#Feedable" });

    const importEdge = repo.edges.find((e) => e.kind === "imports");
    expect(importEdge).toMatchObject({ from: "dog.ts", to: "animal.ts" });
  });

  it("captures constructor parameter properties (DI-style fields) and infers composition from them", () => {
    const files = parseTypeScriptProject(fixturesDir);
    const repo = buildRepoIR({ repoUrl: "fixture/repo", commitSha: "0", files });

    const kennel = repo.classes["kennel.ts#Kennel"];
    expect(kennel).toBeDefined();
    const dogField = kennel.fields.find((f) => f.name === "dog");
    expect(dogField).toMatchObject({ type: "Dog", visibility: "private", isReadonly: true });

    const composesEdge = repo.edges.find((e) => e.kind === "composes" && e.from === "kennel.ts#Kennel");
    expect(composesEdge).toMatchObject({ to: "dog.ts#Dog", label: "dog" });
  });
});
