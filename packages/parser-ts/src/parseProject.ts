import path from "node:path";
import fs from "node:fs";
import {
  ClassDeclaration,
  EnumDeclaration,
  FunctionDeclaration,
  InterfaceDeclaration,
  Project,
  Scope,
  SourceFile,
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

function parseFunction(fn: FunctionDeclaration, relFilePath: string): FunctionIR | undefined {
  const name = fn.getName();
  if (!name) return undefined;
  return {
    id: `${relFilePath}#${name}`,
    name,
    params: extractParams(fn.getParameters()),
    returnType: fn.getReturnTypeNode()?.getText(),
    filePath: relFilePath,
    isExported: fn.isExported(),
    position: positionOf(relFilePath, fn),
  };
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

    const functions: FunctionIR[] = [];
    for (const fn of sourceFile.getFunctions()) {
      const parsed = parseFunction(fn, relFilePath);
      if (parsed) functions.push(parsed);
    }

    const module: ModuleIR = {
      id: relFilePath,
      filePath: relFilePath,
      language,
      imports: parseImports(sourceFile, rootDir),
      classes: classes.map((c) => c.id),
      functions: functions.map((f) => f.id),
      loc: sourceFile.getEndLineNumber(),
    };

    results.push({ module, classes, functions });
  }

  return results;
}
