import type { LanguageParser } from "./types";

/**
 * Extension -> LanguageParser registry. Each language package (parser-ts,
 * parser-python, parser-java, ...) registers itself here at app startup.
 * Adding a new language is: implement LanguageParser, call registerLanguage —
 * no changes needed anywhere else in the pipeline.
 */
const registry = new Map<string, LanguageParser>();

export function registerLanguage(parser: LanguageParser): void {
  for (const ext of parser.extensions) {
    registry.set(ext, parser);
  }
}

export function getParserForFile(filePath: string): LanguageParser | undefined {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return undefined;
  const ext = filePath.slice(dot);
  return registry.get(ext);
}

export function listRegisteredExtensions(): string[] {
  return [...registry.keys()];
}
