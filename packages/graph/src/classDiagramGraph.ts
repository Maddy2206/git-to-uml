import type { RepoIR } from "@git-to-uml/ir";
import type { DiagramGraph } from "./types";
import { formatField, formatMethod } from "./formatMembers";

export interface ClassDiagramOptions {
  /** Only include classes whose filePath starts with this folder prefix. */
  scopeToFolder?: string;
}

const CLASS_EDGE_KINDS = new Set(["extends", "implements", "composes", "aggregates"]);

/** UML stereotype label shown above the class name for non-class kinds. Single source of truth for both sizing (layout package) and rendering (excalidraw-gen). */
const STEREOTYPE: Record<DiagramGraph["nodes"][number]["kind"], string | null> = {
  class: null,
  interface: "«interface»",
  enum: "«enum»",
  folder: null,
};

/**
 * Class-level view of the RepoIR: one node per class/interface/enum, edges
 * for extends/implements/composes/aggregates. This is what the elkjs class
 * diagram layout and Excalidraw class-box generator both consume.
 */
export function buildClassDiagramGraph(repo: RepoIR, options: ClassDiagramOptions = {}): DiagramGraph {
  const classes = Object.values(repo.classes).filter(
    (c) => !options.scopeToFolder || c.filePath === "external" || c.filePath.startsWith(options.scopeToFolder),
  );
  const includedIds = new Set(classes.map((c) => c.id));

  const nodes = classes.map((cls) => {
    const stereotype = STEREOTYPE[cls.kind];
    return {
      id: cls.id,
      label: cls.name,
      kind: cls.kind,
      headerLines: stereotype ? [stereotype, cls.name] : [cls.name],
      compartments: {
        fields: cls.fields.map(formatField),
        methods: cls.methods.map(formatMethod),
      },
    };
  });

  const edges = repo.edges
    .filter((e) => CLASS_EDGE_KINDS.has(e.kind) && includedIds.has(e.from) && includedIds.has(e.to))
    .map((e) => ({ id: e.id, kind: e.kind, from: e.from, to: e.to, label: e.label }));

  return { nodes, edges };
}
