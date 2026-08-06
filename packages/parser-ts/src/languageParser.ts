import { Project } from "ts-morph";
import type { LanguageParser, ParsedFile } from "@git-to-uml/ir";
import { parseTypeScriptProject } from "./parseProject";

/**
 * Single-file LanguageParser conformance, for registry consistency with the
 * tree-sitter-based parsers (parser-python, parser-java) and for unit tests.
 * Cross-file import resolution won't work in this mode (no other files are
 * loaded into the in-memory project) — the pipeline should prefer
 * `parseTypeScriptProject` directly for real repos, which resolves imports
 * (including tsconfig path aliases) across the whole project.
 */
export const tsLanguageParser: LanguageParser = {
  language: "typescript",
  extensions: [".ts", ".tsx", ".js", ".jsx"],
  parseFile(filePath: string, content: string): ParsedFile {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(filePath, content);
    const [result] = parseTypeScriptProject(".", project);
    if (!result) {
      return { module: { id: filePath, filePath, language: "typescript", imports: [], classes: [], functions: [], loc: 0 }, classes: [], functions: [] };
    }
    return result;
  },
};
