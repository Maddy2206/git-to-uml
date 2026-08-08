import type { LanguageParser, ParsedFile } from "@git-to-uml/ir";
import { createTreeSitterParser } from "@git-to-uml/parser-core";
import { parseJavaFile } from "./parseFile";

/**
 * Single-file LanguageParser conformance, for registry consistency with
 * parser-ts/parser-python and for unit tests. Loads its own grammar
 * instance per call, which is fine for this use (tests, ad-hoc single-file
 * parsing) but wasteful for a whole repo — prefer `parseJavaProject` there,
 * which reuses one parser instance across every file.
 */
export const javaLanguageParser: LanguageParser = {
  language: "java",
  extensions: [".java"],
  async parseFile(filePath: string, content: string): Promise<ParsedFile> {
    const parser = await createTreeSitterParser("java");
    return parseJavaFile(filePath, content, parser);
  },
};
