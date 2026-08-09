/**
 * Language-agnostic intermediate representation (IR).
 *
 * Every language parser (ts-morph for TS/JS, tree-sitter for Python/Java, ...)
 * normalizes its output into these types. Nothing downstream of this package
 * (graph construction, layout, Excalidraw generation) knows about source
 * language — see packages/ir/src/languageRegistry.ts for the extension point.
 */

export type NodeKind =
  | "module"
  | "class"
  | "interface"
  | "enum"
  | "function"
  | "method"
  | "field";

export type Visibility = "public" | "private" | "protected" | "package";

export type EdgeKind =
  | "imports"
  | "extends"
  | "implements"
  | "composes"
  | "aggregates"
  | "calls";

export type SupportedLanguage = "typescript" | "javascript" | "python" | "java";

export interface Position {
  file: string;
  startLine: number;
  endLine: number;
}

export interface ParamIR {
  name: string;
  type?: string;
  optional?: boolean;
}

export interface FieldIR {
  id: string;
  name: string;
  type?: string;
  visibility: Visibility;
  isStatic?: boolean;
  isReadonly?: boolean;
  position: Position;
}

export interface MethodIR {
  id: string;
  name: string;
  params: ParamIR[];
  returnType?: string;
  visibility: Visibility;
  isStatic?: boolean;
  isAbstract?: boolean;
  position: Position;
}

export interface ClassIR {
  /** `${filePath}#${name}` */
  id: string;
  kind: "class" | "interface" | "enum";
  name: string;
  filePath: string;
  isAbstract?: boolean;
  isExported?: boolean;
  typeParams?: string[];
  fields: FieldIR[];
  methods: MethodIR[];
  /** Base-class/interface names as written in source, resolved later by resolveInheritance */
  extends?: string[];
  implements?: string[];
  position: Position;
  language: SupportedLanguage;
}

export interface FunctionIR {
  id: string;
  name: string;
  params: ParamIR[];
  returnType?: string;
  filePath: string;
  isExported?: boolean;
  position: Position;
  /**
   * Best-effort role, set by the parser (it has the AST in hand) — drives
   * the diagram stereotype/box color. `undefined` means a plain function.
   */
  role?: "component" | "hook" | "handler";
  /**
   * Names from this file's own imports that are actually referenced inside
   * this function's body — the raw material for inferFunctionUsage's
   * "calls" edges (see @git-to-uml/ir/inferFunctionUsage). A JSX tag name
   * like `<Header />` is just an Identifier reference to `Header` like any
   * other, so this catches component usage too without any JSX-specific
   * parsing.
   */
  usesNames?: string[];
}

export interface ImportEdge {
  /** Module id (filePath) this import is declared in */
  from: string;
  /** Resolved module id (filePath), or the raw specifier if unresolved */
  to: string;
  specifiers: string[];
  resolved: boolean;
}

export interface ModuleIR {
  /** filePath, repo-relative, POSIX separators */
  id: string;
  filePath: string;
  language: SupportedLanguage;
  imports: ImportEdge[];
  /** ClassIR ids declared in this module */
  classes: string[];
  /** FunctionIR ids declared in this module */
  functions: string[];
  loc: number;
}

export interface GraphEdge {
  id: string;
  kind: EdgeKind;
  from: string;
  to: string;
  label?: string;
}

export interface RepoIR {
  repoUrl: string;
  commitSha: string;
  modules: Record<string, ModuleIR>;
  classes: Record<string, ClassIR>;
  functions: Record<string, FunctionIR>;
  edges: GraphEdge[];
}

/** Raw per-file output a LanguageParser produces, before repo-wide linking. */
export interface ParsedFile {
  module: ModuleIR;
  classes: ClassIR[];
  functions: FunctionIR[];
}

/** Extension point every language parser implements — see packages/parser-ts, parser-python, parser-java. */
export interface LanguageParser {
  language: SupportedLanguage;
  /** File extensions this parser handles, e.g. ['.ts', '.tsx'] */
  extensions: string[];
  /**
   * Sync for ts-morph (parser-ts), async for tree-sitter-based parsers
   * (parser-python, parser-java — WASM grammar instantiation is inherently
   * async). Callers should always `await` the result.
   */
  parseFile(filePath: string, content: string): ParsedFile | Promise<ParsedFile>;
}
