import type { ClassIR, GraphEdge } from "./types";

/**
 * Matches `extends`/`implements` name strings (as written in source) against
 * in-repo ClassIR ids. Unmatched names get a synthetic "external" placeholder
 * class so relationship arrows still have somewhere to point (e.g. a class
 * extending a library base class that isn't part of the parsed repo).
 */
export function resolveInheritance(classes: Record<string, ClassIR>): {
  edges: GraphEdge[];
  externalClasses: Record<string, ClassIR>;
} {
  const byName = new Map<string, ClassIR[]>();
  for (const cls of Object.values(classes)) {
    const list = byName.get(cls.name) ?? [];
    list.push(cls);
    byName.set(cls.name, list);
  }

  const edges: GraphEdge[] = [];
  const externalClasses: Record<string, ClassIR> = {};
  let edgeSeq = 0;

  const resolveTarget = (fromClass: ClassIR, rawName: string): string => {
    // Strip generic type args, e.g. `Repository<User>` -> `Repository`
    const name = rawName.split("<")[0].trim();
    const candidates = byName.get(name);
    if (candidates && candidates.length > 0) {
      // Prefer a candidate in the same file, else the first match.
      const sameFile = candidates.find((c) => c.filePath === fromClass.filePath);
      return (sameFile ?? candidates[0]).id;
    }
    const externalId = `external#${name}`;
    if (!externalClasses[externalId]) {
      externalClasses[externalId] = {
        id: externalId,
        kind: "class",
        name,
        filePath: "external",
        fields: [],
        methods: [],
        position: { file: "external", startLine: 0, endLine: 0 },
        language: fromClass.language,
        isExported: false,
      };
    }
    return externalId;
  };

  for (const cls of Object.values(classes)) {
    for (const baseName of cls.extends ?? []) {
      edges.push({
        id: `edge-extends-${edgeSeq++}`,
        kind: "extends",
        from: cls.id,
        to: resolveTarget(cls, baseName),
      });
    }
    for (const ifaceName of cls.implements ?? []) {
      edges.push({
        id: `edge-implements-${edgeSeq++}`,
        kind: "implements",
        from: cls.id,
        to: resolveTarget(cls, ifaceName),
      });
    }
  }

  return { edges, externalClasses };
}
