import type { ParsedFile, RepoIR } from "./types";
import { resolveInheritance } from "./resolveInheritance";
import { resolveImports } from "./resolveImports";
import { inferComposition } from "./inferComposition";

export interface BuildRepoIROptions {
  repoUrl: string;
  commitSha: string;
  files: ParsedFile[];
}

/**
 * Merges per-file parser output into one RepoIR, then runs the linking passes:
 * resolveImports (module graph), resolveInheritance (extends/implements ->
 * GraphEdge, synthesizing external placeholder classes), inferComposition
 * (best-effort field/param type matching -> composes/aggregates edges).
 */
export function buildRepoIR({ repoUrl, commitSha, files }: BuildRepoIROptions): RepoIR {
  const repo: RepoIR = {
    repoUrl,
    commitSha,
    modules: {},
    classes: {},
    functions: {},
    edges: [],
  };

  for (const file of files) {
    repo.modules[file.module.id] = file.module;
    for (const cls of file.classes) repo.classes[cls.id] = cls;
    for (const fn of file.functions) repo.functions[fn.id] = fn;
  }

  resolveImports(repo.modules);
  for (const mod of Object.values(repo.modules)) {
    for (const imp of mod.imports) {
      if (imp.resolved) {
        repo.edges.push({
          id: `edge-imports-${mod.id}->${imp.to}`,
          kind: "imports",
          from: mod.id,
          to: imp.to,
          label: imp.specifiers.join(", ") || undefined,
        });
      }
    }
  }

  const { edges: inheritanceEdges, externalClasses } = resolveInheritance(repo.classes);
  repo.edges.push(...inheritanceEdges);
  Object.assign(repo.classes, externalClasses);

  repo.edges.push(...inferComposition(repo.classes));

  return repo;
}
