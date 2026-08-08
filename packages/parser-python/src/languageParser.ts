import type { LanguageParser, ParsedFile } from "@git-to-uml/ir";
import { createTreeSitterParser } from "@git-to-uml/parser-core";
import { parsePythonFile } from "./parseFile";

/**
 * Single-file LanguageParser conformance, for registry consistency with
 * parser-ts/parser-java and for unit tests. Loads its own grammar instance
 * per call, which is fine for this use (tests, ad-hoc single-file parsing)
 * but wasteful for a whole repo — prefer `parsePythonProject` there, which
 * reuses one parser instance across every file.
 */
export const pythonLanguageParser: LanguageParser = {
  language: "python",
  extensions: [".py"],
  async parseFile(filePath: string, content: string): Promise<ParsedFile> {
    const parser = await createTreeSitterParser("python");
    return parsePythonFile(filePath, content, parser);
  },
};
