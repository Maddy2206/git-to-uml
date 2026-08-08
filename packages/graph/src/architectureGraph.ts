import type { RepoIR } from "@git-to-uml/ir";
import type { DiagramGraph } from "./types";
import { CATEGORY_LABEL, CATEGORY_ORDER, classifyModule, type ComponentCategory } from "./componentClassifier";

const MAX_LISTED_CLASSES = 12;

/**
 * High-level *system* architecture view of the RepoIR — the handful of
 * logical components you'd draw in a system-design interview (API gateway,
 * database, cache, ...), not one box per source directory. Each module is
 * heuristically classified into a ComponentCategory (see
 * componentClassifier.ts) by path/naming convention and, failing that, by
 * the packages it imports. Edges are import edges aggregated up from
 * file-level to category-level (weighted by how many underlying imports
 * they represent); same-category imports are dropped as noise at this zoom
 * level. Classes/entities found in each category are listed as a
 * compartment (capped, e.g. the actual table/model names in the Database
 * box) so the box carries real information, not just a label.
 */
export function buildArchitectureGraph(repo: RepoIR): DiagramGraph {
  const categoryByModuleId = new Map<string, ComponentCategory>();
  for (const mod of Object.values(repo.modules)) {
    categoryByModuleId.set(mod.id, classifyModule(mod));
  }

  const classNamesByCategory = new Map<ComponentCategory, string[]>();
  for (const cls of Object.values(repo.classes)) {
    if (cls.filePath === "external") continue;
    const category = categoryByModuleId.get(cls.filePath);
    if (!category) continue;
    const list = classNamesByCategory.get(category) ?? [];
    list.push(cls.name);
    classNamesByCategory.set(category, list);
  }

  const usedCategories = new Set(categoryByModuleId.values());
  const nodes = CATEGORY_ORDER.filter((c) => usedCategories.has(c)).map((category) => {
    const classNames = (classNamesByCategory.get(category) ?? []).sort();
    const shown = classNames.slice(0, MAX_LISTED_CLASSES);
    if (classNames.length > MAX_LISTED_CLASSES) shown.push(`+${classNames.length - MAX_LISTED_CLASSES} more`);
    return {
      id: category,
      label: CATEGORY_LABEL[category],
      kind: "folder" as const,
      headerLines: [CATEGORY_LABEL[category]],
      compartments: { fields: shown, methods: [] },
    };
  });

  const edgeWeights = new Map<string, { from: ComponentCategory; to: ComponentCategory; count: number }>();
  for (const edge of repo.edges) {
    if (edge.kind !== "imports") continue;
    const fromMod = repo.modules[edge.from];
    const toMod = repo.modules[edge.to];
    if (!fromMod || !toMod) continue;
    const from = categoryByModuleId.get(fromMod.id)!;
    const to = categoryByModuleId.get(toMod.id)!;
    if (from === to) continue;
    // NUL can't appear in a real category key, so this stays unambiguous.
    const key = `${from}\0${to}`;
    const existing = edgeWeights.get(key);
    if (existing) existing.count += 1;
    else edgeWeights.set(key, { from, to, count: 1 });
  }

  const edges = [...edgeWeights.values()].map((w, i) => ({
    id: `arch-edge-${i}`,
    kind: "imports" as const,
    from: w.from,
    to: w.to,
    label: w.count > 1 ? `×${w.count}` : undefined,
  }));

  return { nodes, edges };
}
