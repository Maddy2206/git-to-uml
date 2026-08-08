import fs from "node:fs/promises";
import type { ParsedFile } from "@git-to-uml/ir";
import { createTreeSitterParser } from "@git-to-uml/parser-core";
import { walkJavaFiles } from "./fileWalker";
import { parseJavaFile } from "./parseFile";
import { toRelPath } from "./pathUtils";

/**
 * Parses every `.java` file under `rootDir`, reusing one loaded tree-sitter
 * parser across all of them (grammar instantiation is the expensive part —
 * parsing individual files with an already-loaded grammar is cheap).
 */
export async function parseJavaProject(rootDir: string): Promise<ParsedFile[]> {
  const files = await walkJavaFiles(rootDir);
  if (files.length === 0) return [];

  const parser = await createTreeSitterParser("java");
  const results: ParsedFile[] = [];
  for (const absPath of files) {
    const source = await fs.readFile(absPath, "utf8");
    const relFilePath = toRelPath(rootDir, absPath);
    results.push(parseJavaFile(relFilePath, source, parser));
  }
  return results;
}
