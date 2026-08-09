import type { RepoIR } from "@git-to-uml/ir";
import type { DiagramGraph } from "./types";
import { formatField, formatFunctionSignature, formatMethod } from "./formatMembers";

export interface ClassDiagramOptions {
  /** Only include classes whose filePath starts with this folder prefix. */
  scopeToFolder?: string;
}

const CLASS_EDGE_KINDS = new Set(["extends", "implements", "composes", "aggregates", "calls"]);

/** UML stereotype label shown above the class/function name for non-class kinds. Single source of truth for both sizing (layout package) and rendering (excalidraw-gen). */
const STEREOTYPE: Record<DiagramGraph["nodes"][number]["kind"], string | null> = {
  class: null,
  interface: "«interface»",
  enum: "«enum»",
  folder: null,
  component: "«component»",
  hook: "«hook»",
  handler: "«api route»",
  function: null,
};

/**
 * Class-level view of the RepoIR: one node per class/interface/enum *and*
 * per function/component/hook/route-handler (function-based codebases —
 * React/Next.js in particular — have few or no classes at all, so without
 * these the diagram would be nearly empty), edges for
 * extends/implements/composes/aggregates/calls. This is what the elkjs
 * class diagram layout and Excalidraw class-box generator both consume.
 */
export function buildClassDiagramGraph(repo: RepoIR, options: ClassDiagramOptions = {}): DiagramGraph {
  const classes = Object.values(repo.classes).filter(
    (c) => !options.scopeToFolder || c.filePath === "external" || c.filePath.startsWith(options.scopeToFolder),
  );
  const functions = Object.values(repo.functions).filter(
    (f) => !options.scopeToFolder || f.filePath.startsWith(options.scopeToFolder),
  );
  const includedIds = new Set([...classes.map((c) => c.id), ...functions.map((f) => f.id)]);

  const classNodes = classes.map((cls) => {
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

  const functionNodes = functions.map((fn) => {
    const kind = fn.role ?? ("function" as const);
    const stereotype = STEREOTYPE[kind];
    return {
      id: fn.id,
      label: fn.name,
      kind,
      headerLines: stereotype ? [stereotype, fn.name] : [fn.name],
      compartments: {
        fields: [],
        methods: [formatFunctionSignature(fn)],
      },
    };
  });

  const edges = repo.edges
    .filter((e) => CLASS_EDGE_KINDS.has(e.kind) && includedIds.has(e.from) && includedIds.has(e.to))
    .map((e) => ({ id: e.id, kind: e.kind, from: e.from, to: e.to, label: e.label }));

  return { nodes: [...classNodes, ...functionNodes], edges };
}
