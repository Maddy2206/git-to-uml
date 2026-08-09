import path from "node:path";
import fs from "node:fs";
import {
  ArrowFunction,
  ClassDeclaration,
  EnumDeclaration,
  FunctionDeclaration,
  FunctionExpression,
  InterfaceDeclaration,
  Node,
  Project,
  Scope,
  SourceFile,
  SyntaxKind,
} from "ts-morph";
import type {
  ClassIR,
  FieldIR,
  FunctionIR,
  ImportEdge,
  MethodIR,
  ModuleIR,
  ParamIR,
  ParsedFile,
  Position,
  SupportedLanguage,
  Visibility,
} from "@git-to-uml/ir";
import { toRelPath } from "./pathUtils";

const IGNORED_DIR_SEGMENTS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", "coverage"]);

function scopeToVisibility(scope: Scope | undefined): Visibility {
  switch (scope) {
    case Scope.Private:
      return "private";
    case Scope.Protected:
      return "protected";
    default:
      return "public";
  }
}

function languageForFile(filePath: string): SupportedLanguage {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx") ? "typescript" : "javascript";
}

function positionOf(relFilePath: string, node: { getStartLineNumber(): number; getEndLineNumber(): number }): Position {
  return { file: relFilePath, startLine: node.getStartLineNumber(), endLine: node.getEndLineNumber() };
}

/**
 * Loads a ts-morph Project rooted at `rootDir`, preferring an existing
 * tsconfig.json (so path aliases resolve correctly) and falling back to a
 * permissive default config (allowJs, jsx) that just globs source files.
 */
export function createTsProject(rootDir: string): Project {
  const tsConfigFilePath = path.join(rootDir, "tsconfig.json");
  if (fs.existsSync(tsConfigFilePath)) {
    return new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: false });
  }

  const project = new Project({
    compilerOptions: {
      allowJs: true,
      jsx: 4 /* ts.JsxEmit.ReactJSX */ as any,
      target: 99 /* ts.ScriptTarget.Latest */ as any,
      moduleResolution: 100 /* ts.ModuleResolutionKind.Bundler */ as any,
    },
  });
  project.addSourceFilesAtPaths([
    `${rootDir}/**/*.{ts,tsx,js,jsx}`,
    `!${rootDir}/**/node_modules/**`,
    `!${rootDir}/**/dist/**`,
    `!${rootDir}/**/build/**`,
    `!${rootDir}/**/.next/**`,
  ]);
  return project;
}

function extractParams(params: { getName(): string; getTypeNode?: () => { getText(): string } | undefined; isOptional?: () => boolean }[]): ParamIR[] {
  return params.map((p) => ({
    name: p.getName(),
    type: p.getTypeNode?.()?.getText(),
    optional: p.isOptional?.(),
  }));
}

function extractFieldsAndMethods(
  classId: string,
  relFilePath: string,
  members: {
    properties: { getName(): string; getTypeNode(): { getText(): string } | undefined; getScope?: () => Scope; isStatic(): boolean; isReadonly?: () => boolean; getStartLineNumber(): number; getEndLineNumber(): number }[];
    methods: { getName(): string; getParameters(): any[]; getReturnTypeNode(): { getText(): string } | undefined; getScope?: () => Scope; isStatic(): boolean; isAbstract?: () => boolean; getStartLineNumber(): number; getEndLineNumber(): number }[];
  },
): { fields: FieldIR[]; methods: MethodIR[] } {
  const fields: FieldIR[] = members.properties.map((prop) => ({
    id: `${classId}.${prop.getName()}`,
    name: prop.getName(),
    type: prop.getTypeNode()?.getText(),
    visibility: scopeToVisibility(prop.getScope?.()),
    isStatic: prop.isStatic(),
    isReadonly: prop.isReadonly?.(),
    position: positionOf(relFilePath, prop),
  }));

  const methods: MethodIR[] = members.methods.map((m) => ({
    id: `${classId}.${m.getName()}`,
    name: m.getName(),
    params: extractParams(m.getParameters()),
    returnType: m.getReturnTypeNode()?.getText(),
    visibility: scopeToVisibility(m.getScope?.()),
    isStatic: m.isStatic(),
    isAbstract: m.isAbstract?.(),
    position: positionOf(relFilePath, m),
  }));

  return { fields, methods };
}

/**
 * TypeScript's constructor parameter-property shorthand —
 * `constructor(private readonly repo: UserRepo) {}` — declares a class
 * field without a separate `PropertyDeclaration`, so `cls.getProperties()`
 * alone misses it entirely. This is extremely common in dependency-injection
 * style code (every constructor-injected collaborator is a parameter
 * property), so skipping it was silently dropping most of a typical
 * repo's fields — and, downstream, most of the composition edges
 * inferComposition would otherwise have found between those fields' types.
 */
function extractConstructorPropertyFields(cls: ClassDeclaration, classId: string, relFilePath: string): FieldIR[] {
  const ctor = cls.getConstructors().find((c) => c.getBody() !== undefined) ?? cls.getConstructors()[0];
  if (!ctor) return [];
  return ctor
    .getParameters()
    .filter((p) => p.isParameterProperty())
    .map((p) => ({
      id: `${classId}.${p.getName()}`,
      name: p.getName(),
      type: p.getTypeNode()?.getText(),
      visibility: scopeToVisibility(p.getScope()),
      isReadonly: p.isReadonly(),
      position: positionOf(relFilePath, p),
    }));
}

function parseClass(cls: ClassDeclaration, relFilePath: string, language: SupportedLanguage): ClassIR | undefined {
  const name = cls.getName();
  if (!name) return undefined; // skip anonymous default-export classes for MVP
  const id = `${relFilePath}#${name}`;
  const { fields: declaredFields, methods } = extractFieldsAndMethods(id, relFilePath, {
    properties: cls.getProperties(),
    methods: cls.getMethods(),
  });
  const fields = [...declaredFields, ...extractConstructorPropertyFields(cls, id, relFilePath)];
  const extendsExpr = cls.getExtends();

  return {
    id,
    kind: "class",
    name,
    filePath: relFilePath,
    isAbstract: cls.isAbstract(),
    isExported: cls.isExported(),
    typeParams: cls.getTypeParameters().map((tp) => tp.getName()),
    fields,
    methods,
    extends: extendsExpr ? [extendsExpr.getText()] : [],
    implements: cls.getImplements().map((i) => i.getText()),
    position: positionOf(relFilePath, cls),
    language,
  };
}

function parseInterface(iface: InterfaceDeclaration, relFilePath: string, language: SupportedLanguage): ClassIR {
  const name = iface.getName();
  const id = `${relFilePath}#${name}`;
  const fields: FieldIR[] = iface.getProperties().map((prop) => ({
    id: `${id}.${prop.getName()}`,
    name: prop.getName(),
    type: prop.getTypeNode()?.getText(),
    visibility: "public",
    position: positionOf(relFilePath, prop),
  }));
  const methods: MethodIR[] = iface.getMethods().map((m) => ({
    id: `${id}.${m.getName()}`,
    name: m.getName(),
    params: extractParams(m.getParameters()),
    returnType: m.getReturnTypeNode()?.getText(),
    visibility: "public",
    position: positionOf(relFilePath, m),
  }));

  return {
    id,
    kind: "interface",
    name,
    filePath: relFilePath,
    isExported: iface.isExported(),
    typeParams: iface.getTypeParameters().map((tp) => tp.getName()),
    fields,
    methods,
    extends: iface.getExtends().map((e) => e.getText()),
    implements: [],
    position: positionOf(relFilePath, iface),
    language,
  };
}

function parseEnum(en: EnumDeclaration, relFilePath: string, language: SupportedLanguage): ClassIR {
  const name = en.getName();
  const id = `${relFilePath}#${name}`;
  const fields: FieldIR[] = en.getMembers().map((member) => ({
    id: `${id}.${member.getName()}`,
    name: member.getName(),
    visibility: "public",
    position: positionOf(relFilePath, member),
  }));

  return {
    id,
    kind: "enum",
    name,
    filePath: relFilePath,
    isExported: en.isExported(),
    fields,
    methods: [],
    extends: [],
    implements: [],
    position: positionOf(relFilePath, en),
    language,
  };
}

// ---- Function/component/hook/route-handler extraction ----

const HTTP_METHOD_EXPORT_NAMES = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
/** Matches a Next.js App Router route file — `app/**\/route.ts(x)` — at any depth, or bare `route.ts` at the root. */
const NEXTJS_ROUTE_FILE_RE = /(^|\/)route\.(ts|tsx|js|jsx)$/;
const NEXTJS_PAGES_API_RE = /^pages\/api\//;
const HOOK_NAME_RE = /^use[A-Z]/;
const COMPONENT_NAME_RE = /^[A-Z]/;

/** Next.js App Router special filenames whose default export is conventionally anonymous (`export default function() {...}`) — synthesize a recognizable name instead of silently dropping them. */
const SPECIAL_FILE_NAMES: Record<string, string> = {
  page: "Page",
  layout: "Layout",
  template: "Template",
  loading: "Loading",
  error: "Error",
  "not-found": "NotFound",
  default: "Default",
};

function deriveNameForAnonymousDefault(relFilePath: string): string | undefined {
  const fileName = relFilePath.split("/").pop() ?? "";
  const stem = fileName.replace(/\.(ts|tsx|js|jsx)$/, "");
  return SPECIAL_FILE_NAMES[stem];
}

function hasJsx(fnNode: Node): boolean {
  return (
    fnNode.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
    fnNode.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    fnNode.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
  );
}

/**
 * Best-effort role classification — a hook by naming convention, an API
 * route handler by Next.js file/export convention, or a component when the
 * name is PascalCase *and* the body actually contains JSX (both signals
 * together avoid false-positiving on an unrelated PascalCase function).
 */
function detectRole(name: string, relFilePath: string, fnNode: Node, isDefaultExport: boolean): FunctionIR["role"] {
  if (NEXTJS_ROUTE_FILE_RE.test(relFilePath) && HTTP_METHOD_EXPORT_NAMES.has(name)) return "handler";
  if (NEXTJS_PAGES_API_RE.test(relFilePath) && isDefaultExport) return "handler";
  if (HOOK_NAME_RE.test(name)) return "hook";
  if (COMPONENT_NAME_RE.test(name) && hasJsx(fnNode)) return "component";
  return undefined;
}

/**
 * Unwraps a function literal passed directly to a higher-order call —
 * `const GET = auth((req) => {...})`, `const Foo = memo(() => {...})`,
 * `const Foo = forwardRef((props, ref) => {...})` — all extremely common in
 * real Next.js/React code (auth middleware wrappers, `React.memo`,
 * `React.forwardRef`) and otherwise invisible to this parser, since the
 * variable's own initializer is a CallExpression, not a function literal.
 * Only looks one call deep and takes the first function-literal argument —
 * deeper/more exotic wrapping is out of scope for this heuristic.
 */
function unwrapFunctionLike(node: Node): ArrowFunction | FunctionExpression | undefined {
  if (Node.isArrowFunction(node)) return node;
  if (Node.isFunctionExpression(node)) return node;
  if (Node.isCallExpression(node)) {
    for (const arg of node.getArguments()) {
      if (Node.isArrowFunction(arg)) return arg;
      if (Node.isFunctionExpression(arg)) return arg;
    }
  }
  return undefined;
}

/** Every identifier this function's body references that's also one of its file's own import names — see FunctionIR.usesNames. */
function computeUsesNames(fnNode: Node, importedNames: Set<string>): string[] {
  const used = new Set<string>();
  for (const id of fnNode.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const text = id.getText();
    if (importedNames.has(text)) used.add(text);
  }
  return [...used];
}

function parseFunction(fn: FunctionDeclaration, relFilePath: string, importedNames: Set<string>): FunctionIR | undefined {
  const isDefaultExport = fn.isDefaultExport();
  const name = fn.getName() || (isDefaultExport ? deriveNameForAnonymousDefault(relFilePath) : undefined);
  if (!name) return undefined; // anonymous, non-special-file default export — nothing recognizable to call it

  return {
    id: `${relFilePath}#${name}`,
    name,
    params: extractParams(fn.getParameters()),
    returnType: fn.getReturnTypeNode()?.getText(),
    filePath: relFilePath,
    isExported: fn.isExported(),
    position: positionOf(relFilePath, fn),
    role: detectRole(name, relFilePath, fn, isDefaultExport),
    usesNames: computeUsesNames(fn, importedNames),
  };
}

/**
 * `const Foo = () => {...}` / `export const useFoo = () => {...}` —
 * function-declaration syntax (`sourceFile.getFunctions()`) never sees
 * these at all, but this is how the overwhelming majority of React
 * components and every arrow-function hook are actually written. Also
 * unwraps one level of higher-order-call wrapping (`const GET =
 * auth((req) => {...})`, `const Foo = memo(() => {...})`) via
 * unwrapFunctionLike — see its docstring for why that matters.
 */
function parseVariableFunctions(sourceFile: SourceFile, relFilePath: string, importedNames: Set<string>): FunctionIR[] {
  const results: FunctionIR[] = [];

  for (const varStmt of sourceFile.getVariableStatements()) {
    const isExported = varStmt.isExported();
    for (const decl of varStmt.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (!initializer) continue;
      const fnNode = unwrapFunctionLike(initializer);
      if (!fnNode) continue;

      const name = decl.getName();
      if (!name) continue;

      results.push({
        id: `${relFilePath}#${name}`,
        name,
        params: extractParams(fnNode.getParameters()),
        returnType: fnNode.getReturnTypeNode()?.getText(),
        filePath: relFilePath,
        isExported,
        position: positionOf(relFilePath, decl),
        // `export default const foo = ...` isn't valid JS/TS syntax, so a
        // variable-declared function is never itself a default export.
        role: detectRole(name, relFilePath, fnNode, false),
        usesNames: computeUsesNames(fnNode, importedNames),
      });
    }
  }

  return results;
}

function parseImports(sourceFile: SourceFile, rootDir: string): ImportEdge[] {
  const relFilePath = toRelPath(rootDir, sourceFile.getFilePath());
  const edges: ImportEdge[] = [];

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const specifiers: string[] = [];
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) specifiers.push(defaultImport.getText());
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport) specifiers.push(namespaceImport.getText());
    for (const named of importDecl.getNamedImports()) specifiers.push(named.getName());

    let resolvedSourceFile: SourceFile | undefined;
    try {
      resolvedSourceFile = importDecl.getModuleSpecifierSourceFile();
    } catch {
      resolvedSourceFile = undefined;
    }

    const isInRepo = resolvedSourceFile && !resolvedSourceFile.getFilePath().includes("/node_modules/");
    edges.push({
      from: relFilePath,
      to: isInRepo ? toRelPath(rootDir, resolvedSourceFile!.getFilePath()) : importDecl.getModuleSpecifierValue(),
      specifiers,
      resolved: Boolean(isInRepo),
    });
  }

  return edges;
}

/**
 * Parses every TS/JS/TSX/JSX file already loaded into `project` and returns
 * one ParsedFile per source file. Whole-project parsing (rather than
 * per-file, as the generic LanguageParser interface suggests) is what lets
 * ts-morph resolve imports — including tsconfig path aliases — accurately.
 */
export function parseTypeScriptProject(rootDir: string, project: Project = createTsProject(rootDir)): ParsedFile[] {
  const results: ParsedFile[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const absPath = sourceFile.getFilePath();
    if ([...absPath.split("/")].some((seg) => IGNORED_DIR_SEGMENTS.has(seg))) continue;
    if (sourceFile.isDeclarationFile()) continue;

    const relFilePath = toRelPath(rootDir, absPath);
    const language = languageForFile(relFilePath);

    const classes: ClassIR[] = [];
    for (const cls of sourceFile.getClasses()) {
      const parsed = parseClass(cls, relFilePath, language);
      if (parsed) classes.push(parsed);
    }
    for (const iface of sourceFile.getInterfaces()) classes.push(parseInterface(iface, relFilePath, language));
    for (const en of sourceFile.getEnums()) classes.push(parseEnum(en, relFilePath, language));

    const imports = parseImports(sourceFile, rootDir);
    const importedNames = new Set(imports.flatMap((e) => e.specifiers));

    const functions: FunctionIR[] = [];
    for (const fn of sourceFile.getFunctions()) {
      const parsed = parseFunction(fn, relFilePath, importedNames);
      if (parsed) functions.push(parsed);
    }
    functions.push(...parseVariableFunctions(sourceFile, relFilePath, importedNames));

    const module: ModuleIR = {
      id: relFilePath,
      filePath: relFilePath,
      language,
      imports,
      classes: classes.map((c) => c.id),
      functions: functions.map((f) => f.id),
      loc: sourceFile.getEndLineNumber(),
    };

    results.push({ module, classes, functions });
  }

  return results;
}
