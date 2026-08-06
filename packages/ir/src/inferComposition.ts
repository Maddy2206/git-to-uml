import type { ClassIR, GraphEdge } from "./types";

// Matches identifier-like tokens inside a type string, e.g. for
// "Promise<CreateUserErrors.EmailAlreadyExistsError | User>" this pulls out
// ["Promise", "CreateUserErrors", "EmailAlreadyExistsError", "User"].
const IDENTIFIER_RE = /[A-Za-z_$][A-Za-z0-9_$]*/g;

/**
 * Heuristic: if a field's, method-param's, or method-return type string
 * matches an in-repo class name, record a composition (field) or
 * aggregation (param/return) edge. This is intentionally best-effort — no
 * real type resolution, just a name match against known classes, since
 * that's all tree-sitter-based parsers (Python/Java) can give us without a
 * full type checker.
 *
 * Resolution works by extracting every identifier-like token out of the
 * type string and testing each against the known class names, rather than
 * trying to specially parse array/generic/union/wrapper syntax. This
 * matters a lot in practice: naively taking "the part before `<`" of
 * `Promise<User>` yields `Promise` and silently loses `User` — exactly the
 * kind of very common wrapper (`Promise<T>`, `Array<T>`, `Result<T>`,
 * `Either<L, R>`, `T | undefined`, `T[]`) that real-world TypeScript is
 * full of. Token extraction finds the inner type regardless of how deeply
 * it's wrapped, at the cost of also trying (and harmlessly failing to
 * match) tokens like `Promise` or `undefined` that aren't in-repo classes.
 */
export function inferComposition(classes: Record<string, ClassIR>): GraphEdge[] {
  const byName = new Map<string, string>(); // name -> classId (first match wins)
  for (const cls of Object.values(classes)) {
    if (!byName.has(cls.name)) byName.set(cls.name, cls.id);
  }

  /** All in-repo class ids referenced anywhere in `type`'s text, deduped, excluding `selfId`. */
  const resolveTypeTargets = (type: string, selfId: string): string[] => {
    const tokens = type.match(IDENTIFIER_RE) ?? [];
    const targets = new Set<string>();
    for (const token of tokens) {
      const id = byName.get(token);
      if (id && id !== selfId) targets.add(id);
    }
    return [...targets];
  };

  const edges: GraphEdge[] = [];
  let edgeSeq = 0;
  const seen = new Set<string>();

  const addEdge = (kind: "composes" | "aggregates", from: string, to: string, label?: string) => {
    const key = `${kind}:${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ id: `edge-${kind}-${edgeSeq++}`, kind, from, to, label });
  };

  for (const cls of Object.values(classes)) {
    for (const field of cls.fields) {
      if (!field.type) continue;
      for (const targetId of resolveTypeTargets(field.type, cls.id)) {
        addEdge("composes", cls.id, targetId, field.name);
      }
    }
    for (const method of cls.methods) {
      for (const param of method.params) {
        if (!param.type) continue;
        for (const targetId of resolveTypeTargets(param.type, cls.id)) {
          addEdge("aggregates", cls.id, targetId);
        }
      }
      if (method.returnType) {
        for (const targetId of resolveTypeTargets(method.returnType, cls.id)) {
          addEdge("aggregates", cls.id, targetId);
        }
      }
    }
  }

  return edges;
}
