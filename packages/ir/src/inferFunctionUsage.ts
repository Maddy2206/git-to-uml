import type { ClassIR, FunctionIR, GraphEdge, ModuleIR } from "./types";

/**
 * Heuristic: if a function's body references an identifier that's also one
 * of its own file's import specifiers, and that import resolves in-repo to
 * a class or function with a matching name, record a "calls" edge.
 *
 * This is intentionally import/usage-based rather than a real call-graph or
 * JSX-render-tree resolution — simpler, and it captures component usage for
 * free: a JSX tag name (`<Header />`) is just an `Identifier` reference to
 * `Header` in ts-morph's AST like any other, so no JSX-specific parsing is
 * needed. It only sees usage *across* files (via an import) — a function
 * calling another function declared in the same file is not detected, since
 * `usesNames` (see FunctionIR) is itself restricted to imported names.
 *
 * Known limitation (matching the existing "composition/aggregation is a
 * heuristic" callout in the README): this pass is not currently
 * AI-overridable the way class relationships are — extending the Groq
 * reasoning prompts to judge function/component usage too is a reasonable
 * future enhancement, out of scope here.
 */
export function inferFunctionUsage(
  functions: Record<string, FunctionIR>,
  modules: Record<string, ModuleIR>,
  classes: Record<string, ClassIR> = {},
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  let edgeSeq = 0;

  const addEdge = (from: string, to: string, label: string) => {
    const key = `calls:${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ id: `edge-calls-${edgeSeq++}`, kind: "calls", from, to, label });
  };

  for (const fn of Object.values(functions)) {
    if (!fn.usesNames?.length) continue;
    const module = modules[fn.filePath];
    if (!module) continue;

    for (const name of fn.usesNames) {
      const importEdge = module.imports.find((imp) => imp.resolved && imp.specifiers.includes(name));
      if (!importEdge) continue;

      const targetId = `${importEdge.to}#${name}`;
      if (targetId === fn.id) continue; // self-import edge case, shouldn't normally happen
      if (functions[targetId] || classes[targetId]) {
        addEdge(fn.id, targetId, name);
      }
    }
  }

  return edges;
}
