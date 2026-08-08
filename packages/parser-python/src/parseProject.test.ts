import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildRepoIR } from "@git-to-uml/ir";
import { parsePythonProject } from "./parseProject";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");

describe("parsePythonProject", () => {
  it("extracts classes, self-assigned fields, inheritance, and relative imports", async () => {
    const files = await parsePythonProject(fixturesDir);
    const repo = buildRepoIR({ repoUrl: "fixture/repo", commitSha: "0", files });

    const animal = repo.classes["animal.py#Animal"];
    expect(animal).toBeDefined();
    expect(animal.fields.map((f) => f.name).sort()).toEqual(["_age", "name"]);
    expect(animal.fields.find((f) => f.name === "_age")).toMatchObject({ visibility: "protected" });
    expect(animal.fields.find((f) => f.name === "name")).toMatchObject({ visibility: "public", type: undefined });
    expect(animal.methods.map((m) => m.name)).toEqual(expect.arrayContaining(["__init__", "speak"]));
    expect(animal.methods.find((m) => m.name === "__init__")?.visibility).toBe("public"); // dunder, not private

    const dog = repo.classes["dog.py#Dog"];
    expect(dog).toBeDefined();
    expect(dog.extends).toEqual(["Animal"]);
    expect(dog.fields.map((f) => f.name).sort()).toEqual(["__secret", "breed"]);
    expect(dog.fields.find((f) => f.name === "__secret")).toMatchObject({ visibility: "private" });
    const staticMethod = dog.methods.find((m) => m.name === "create");
    expect(staticMethod?.isStatic).toBe(true);
    // static methods keep all their declared params (no implicit `self` to drop)
    expect(staticMethod?.params.map((p) => p.name)).toEqual(["name"]);
    // instance methods drop the implicit leading `self`
    const initMethod = dog.methods.find((m) => m.name === "__init__");
    expect(initMethod?.params.map((p) => p.name)).toEqual(["name", "breed"]);
    expect(initMethod?.params.find((p) => p.name === "name")?.type).toBe("str");

    const extendsEdge = repo.edges.find((e) => e.kind === "extends");
    expect(extendsEdge).toMatchObject({ from: "dog.py#Dog", to: "animal.py#Animal" });

    const importEdge = repo.edges.find((e) => e.kind === "imports" && e.from === "dog.py");
    expect(importEdge).toMatchObject({ from: "dog.py", to: "animal.py" });
  });

  it("infers a relationship from a constructor param's type even without a field type annotation", async () => {
    const files = await parsePythonProject(fixturesDir);
    const repo = buildRepoIR({ repoUrl: "fixture/repo", commitSha: "0", files });

    const kennel = repo.classes["kennel.py#Kennel"];
    expect(kennel).toBeDefined();
    expect(kennel.fields.map((f) => f.name)).toEqual(["dog"]);

    // self.dog = dog has no type annotation and no constructor-call RHS, so
    // the field itself carries no inferred type — but __init__'s own `dog:
    // Dog` parameter does, so the relationship still shows up (as an
    // "aggregates" edge from the method param, not "composes" from the field).
    const relationship = repo.edges.find(
      (e) => e.from === "kennel.py#Kennel" && e.to === "dog.py#Dog" && (e.kind === "composes" || e.kind === "aggregates"),
    );
    expect(relationship).toBeDefined();

    const importEdge = repo.edges.find((e) => e.kind === "imports" && e.from === "kennel.py");
    expect(importEdge).toMatchObject({ from: "kennel.py", to: "dog.py" });
  });
});
