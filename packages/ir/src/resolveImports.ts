import type { ModuleIR } from "./types";

/**
 * Best-effort pass to mark import edges as resolved once all modules are known.
 * Language parsers (e.g. ts-morph) may already resolve most imports themselves;
 * this pass catches ones left as raw relative specifiers by trying common
 * extensions / index-file conventions against the known module id set.
 */
export function resolveImports(modules: Record<string, ModuleIR>): void {
  const knownIds = new Set(Object.keys(modules));
  const candidateSuffixes = ["", ".ts", ".tsx", ".js", ".jsx", ".py", ".java", "/index.ts", "/index.js"];

  for (const mod of Object.values(modules)) {
    for (const imp of mod.imports) {
      if (imp.resolved || knownIds.has(imp.to)) {
        imp.resolved = knownIds.has(imp.to) || imp.resolved;
        continue;
      }
      for (const suffix of candidateSuffixes) {
        const candidate = `${imp.to}${suffix}`;
        if (knownIds.has(candidate)) {
          imp.to = candidate;
          imp.resolved = true;
          break;
        }
      }
    }
  }
}
