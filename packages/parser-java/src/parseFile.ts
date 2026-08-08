import type { Parser } from "@git-to-uml/parser-core";
import type { ClassIR, ImportEdge, ModuleIR, ParsedFile } from "@git-to-uml/ir";
import { extractClass, extractEnum, extractInterface } from "./extractClass";
import { computeSourceRoot, extractImport, extractPackageName } from "./extractImports";
import { dirnameOf } from "./pathUtils";

/** Parses one already-read Java source file with an already-loaded parser. */
export function parseJavaFile(relFilePath: string, source: string, parser: Parser): ParsedFile {
  const tree = parser.parse(source);
  const root = tree?.rootNode;
  if (!root) {
    return { module: { id: relFilePath, filePath: relFilePath, language: "java", imports: [], classes: [], functions: [], loc: 0 }, classes: [], functions: [] };
  }

  const packageName = extractPackageName(root);
  const sourceRoot = computeSourceRoot(dirnameOf(relFilePath), packageName);

  const classes: ClassIR[] = [];
  const imports: ImportEdge[] = [];

  for (const node of root.namedChildren) {
    if (!node) continue;
    switch (node.type) {
      case "class_declaration":
        classes.push(extractClass(node, relFilePath));
        break;
      case "interface_declaration":
        classes.push(extractInterface(node, relFilePath));
        break;
      case "enum_declaration":
        classes.push(extractEnum(node, relFilePath));
        break;
      case "import_declaration": {
        const edge = extractImport(node, relFilePath, sourceRoot);
        if (edge) imports.push(edge);
        break;
      }
      default:
        // record_declaration, annotation_type_declaration — not scanned for MVP
        break;
    }
  }

  const module: ModuleIR = {
    id: relFilePath,
    filePath: relFilePath,
    language: "java",
    imports,
    classes: classes.map((c) => c.id),
    functions: [], // Java has no free functions — everything is a class/interface/enum member
    loc: source.split("\n").length,
  };

  return { module, classes, functions: [] };
}
