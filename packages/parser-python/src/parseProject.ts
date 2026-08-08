import fs from "node:fs/promises";
import type { ParsedFile } from "@git-to-uml/ir";
import { createTreeSitterParser } from "@git-to-uml/parser-core";
import { walkPythonFiles } from "./fileWalker";
import { parsePythonFile } from "./parseFile";
import { toRelPath } from "./pathUtils";

/**
 * Parses every `.py` file under `rootDir`, reusing one loaded tree-sitter
 * parser across all of them (grammar instantiation is the expensive part —
 * parsing individual files with an already-loaded grammar is cheap).
 */
export async function parsePythonProject(rootDir: string): Promise<ParsedFile[]> {
  const files = await walkPythonFiles(rootDir);
  if (files.length === 0) return [];

  const parser = await createTreeSitterParser("python");
  const results: ParsedFile[] = [];
  for (const absPath of files) {
    const source = await fs.readFile(absPath, "utf8");
    const relFilePath = toRelPath(rootDir, absPath);
    results.push(parsePythonFile(relFilePath, source, parser));
  }
  return results;
}
