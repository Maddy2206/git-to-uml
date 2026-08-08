import { describe, expect, it } from "vitest";
import { createTreeSitterParser } from "./treeSitterLoader";

describe("createTreeSitterParser", () => {
  it("loads the python grammar and parses a class definition", async () => {
    const parser = await createTreeSitterParser("python");
    const tree = parser.parse("class Foo:\n    pass\n");
    expect(tree).not.toBeNull();
    const classNode = tree!.rootNode.namedChildren.find((n) => n?.type === "class_definition");
    expect(classNode).toBeDefined();
    expect(classNode!.childForFieldName("name")?.text).toBe("Foo");
  });

  it("loads the java grammar and parses a class declaration", async () => {
    const parser = await createTreeSitterParser("java");
    const tree = parser.parse("public class Foo {}");
    expect(tree).not.toBeNull();
    const classNode = tree!.rootNode.namedChildren.find((n) => n?.type === "class_declaration");
    expect(classNode).toBeDefined();
    expect(classNode!.childForFieldName("name")?.text).toBe("Foo");
  });
});
