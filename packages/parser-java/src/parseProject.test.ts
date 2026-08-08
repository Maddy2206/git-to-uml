import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildRepoIR } from "@git-to-uml/ir";
import { parseJavaProject } from "./parseProject";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const ANIMAL_DIR = "src/main/java/com/example/animals";
const KENNEL_DIR = "src/main/java/com/example/kennel";

describe("parseJavaProject", () => {
  it("extracts classes, interfaces, modifiers-based visibility, and extends/implements", async () => {
    const files = await parseJavaProject(fixturesDir);
    const repo = buildRepoIR({ repoUrl: "fixture/repo", commitSha: "0", files });

    const animal = repo.classes[`${ANIMAL_DIR}/Animal.java#Animal`];
    expect(animal).toBeDefined();
    expect(animal.isAbstract).toBe(true);
    expect(animal.fields.find((f) => f.name === "name")).toMatchObject({ visibility: "private", type: "String" });
    expect(animal.fields.find((f) => f.name === "age")).toMatchObject({ visibility: "protected" });
    const speak = animal.methods.find((m) => m.name === "speak");
    expect(speak).toMatchObject({ isAbstract: true, visibility: "public" });

    const feedable = repo.classes[`${ANIMAL_DIR}/Feedable.java#Feedable`];
    expect(feedable).toBeDefined();
    expect(feedable.kind).toBe("interface");
    expect(feedable.methods.map((m) => m.name)).toEqual(["feed"]);

    const dog = repo.classes[`${ANIMAL_DIR}/Dog.java#Dog`];
    expect(dog).toBeDefined();
    expect(dog.extends).toEqual(["Animal"]);
    expect(dog.implements).toEqual(["Feedable"]);
    const staticFactory = dog.methods.find((m) => m.name === "create");
    expect(staticFactory?.isStatic).toBe(true);
    // constructor is captured as a method named after the class
    expect(dog.methods.some((m) => m.name === "Dog")).toBe(true);

    // Same-package "extends"/"implements" resolve to real in-repo classes
    // even with no import statement between them (Java doesn't require one
    // within the same package).
    const extendsEdge = repo.edges.find((e) => e.kind === "extends" && e.from === dog.id);
    expect(extendsEdge).toMatchObject({ to: animal.id });
    const implementsEdge = repo.edges.find((e) => e.kind === "implements" && e.from === dog.id);
    expect(implementsEdge).toMatchObject({ to: feedable.id });
  });

  it("resolves a cross-package absolute import using the file's own package declaration as the source root", async () => {
    const files = await parseJavaProject(fixturesDir);
    const repo = buildRepoIR({ repoUrl: "fixture/repo", commitSha: "0", files });

    const kennelModuleId = `${KENNEL_DIR}/Kennel.java`;
    const dogModuleId = `${ANIMAL_DIR}/Dog.java`;
    const importEdge = repo.edges.find((e) => e.kind === "imports" && e.from === kennelModuleId);
    expect(importEdge).toMatchObject({ to: dogModuleId });

    const kennel = repo.classes[`${kennelModuleId}#Kennel`];
    expect(kennel.fields.find((f) => f.name === "dog")).toMatchObject({ type: "Dog", isReadonly: true, visibility: "private" });

    const composesEdge = repo.edges.find((e) => e.kind === "composes" && e.from === kennel.id);
    expect(composesEdge).toMatchObject({ to: `${dogModuleId}#Dog` });
  });
});
