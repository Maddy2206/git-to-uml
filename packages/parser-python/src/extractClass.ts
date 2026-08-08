import type { Node } from "@git-to-uml/parser-core";
import type { ClassIR, FieldIR } from "@git-to-uml/ir";
import { hasDecorator, positionOf } from "./astHelpers";
import { extractClassLevelField, extractSelfField } from "./extractFields";
import { extractMethod } from "./extractFunction";

/** `class Foo(Bar, Baz, metaclass=Meta):` → `["Bar", "Baz"]` — keyword args (metaclass=...) are skipped, they're not base classes. */
function extractBases(superclasses: Node | null): string[] {
  if (!superclasses) return [];
  const bases: string[] = [];
  for (const child of superclasses.namedChildren) {
    if (!child) continue;
    if (child.type === "identifier") {
      bases.push(child.text);
    } else if (child.type === "attribute") {
      bases.push(child.childForFieldName("attribute")?.text ?? child.text);
    } else if (child.type === "subscript") {
      // Generic base, e.g. `Generic[T]` — use the outer name.
      const value = child.childForFieldName("value");
      if (value?.type === "identifier") bases.push(value.text);
    }
  }
  return bases;
}

/**
 * Extracts one `class` definition (already unwrapped from any enclosing
 * `decorated_definition`) into a ClassIR. Fields come from two places:
 * class-body-level attributes (`name = value`, dataclass-style) and
 * `self.x = value` assignments found anywhere in any method body (Python
 * has no separate field-declaration syntax the way TS/Java do).
 */
export function extractClass(node: Node, relFilePath: string): ClassIR {
  const name = node.childForFieldName("name")!.text;
  const id = `${relFilePath}#${name}`;
  const body = node.childForFieldName("body");

  const methods: ClassIR["methods"] = [];
  const fieldsByName = new Map<string, FieldIR>();

  for (const stmt of body?.namedChildren ?? []) {
    if (!stmt) continue;

    if (stmt.type === "expression_statement") {
      const assign = stmt.namedChildren[0];
      if (assign?.type === "assignment") {
        const field = extractClassLevelField(assign, id, relFilePath);
        if (field) fieldsByName.set(field.name, field);
      }
      continue;
    }

    const isDecorated = stmt.type === "decorated_definition";
    const fnNode = isDecorated ? stmt.childForFieldName("definition") : stmt;
    if (fnNode?.type !== "function_definition") continue;

    const isStatic = isDecorated && hasDecorator(stmt, "staticmethod");
    methods.push(extractMethod(fnNode, id, relFilePath, isStatic));

    // self.x = ... assignments anywhere in the method body, at any nesting
    // depth (inside if/for/try/with blocks) — descendantsOfType handles the
    // recursive walk for us.
    for (const assign of fnNode.descendantsOfType("assignment")) {
      if (!assign) continue;
      const field = extractSelfField(assign, id, relFilePath);
      if (field && !fieldsByName.has(field.name)) fieldsByName.set(field.name, field);
    }
  }

  return {
    id,
    kind: "class",
    name,
    filePath: relFilePath,
    isExported: true, // Python has no export keyword; every top-level class is importable
    fields: [...fieldsByName.values()],
    methods,
    extends: extractBases(node.childForFieldName("superclasses")),
    implements: [],
    position: positionOf(relFilePath, node),
    language: "python",
  };
}
