import type { Parser } from "@git-to-uml/parser-core";
import type { ClassIR, FunctionIR, ImportEdge, ModuleIR, ParsedFile } from "@git-to-uml/ir";
import { extractClass } from "./extractClass";
import { extractFunction } from "./extractFunction";
import { extractImports } from "./extractImports";

/** Parses one already-read Python source file with an already-loaded parser. */
export function parsePythonFile(relFilePath: string, source: string, parser: Parser): ParsedFile {
  const tree = parser.parse(source);
  const root = tree?.rootNode;

  const classes: ClassIR[] = [];
  const functions: FunctionIR[] = [];
  const imports: ImportEdge[] = [];

  for (const node of root?.namedChildren ?? []) {
    if (!node) continue;

    switch (node.type) {
      case "class_definition":
        classes.push(extractClass(node, relFilePath));
        break;
      case "function_definition":
        functions.push(extractFunction(node, relFilePath));
        break;
      case "decorated_definition": {
        const def = node.childForFieldName("definition");
        if (def?.type === "class_definition") classes.push(extractClass(def, relFilePath));
        else if (def?.type === "function_definition") functions.push(extractFunction(def, relFilePath));
        break;
      }
      case "import_statement":
      case "import_from_statement":
        imports.push(...extractImports(node, relFilePath));
        break;
      default:
        // Module-level control flow (if/try/with) can contain classes/defs
        // too (common for conditional imports) — not scanned for MVP.
        break;
    }
  }

  const module: ModuleIR = {
    id: relFilePath,
    filePath: relFilePath,
    language: "python",
    imports,
    classes: classes.map((c) => c.id),
    functions: functions.map((f) => f.id),
    loc: source.split("\n").length,
  };

  return { module, classes, functions };
}
