import type { Node } from "@git-to-uml/parser-core";
import type { Position, Visibility } from "@git-to-uml/ir";

export function positionOf(relFilePath: string, node: Node): Position {
  return { file: relFilePath, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1 };
}

/**
 * Python has no visibility keywords — visibility is a naming convention:
 * dunder names (`__init__`) are the public special-method protocol, a
 * double-underscore prefix (`__x`) triggers real name-mangling (closest
 * analog to `private`), and a single leading underscore (`_x`) is the
 * "internal use" convention (closest analog to `protected`).
 */
export function visibilityFromName(name: string): Visibility {
  if (name.startsWith("__") && name.endsWith("__")) return "public";
  if (name.startsWith("__")) return "private";
  if (name.startsWith("_")) return "protected";
  return "public";
}

/** True if a `decorated_definition` node has a decorator matching `name` (e.g. `@staticmethod`). */
export function hasDecorator(decoratedNode: Node, name: string): boolean {
  return decoratedNode.namedChildren.some((child) => {
    if (!child || child.type !== "decorator") return false;
    // decorator's child is the expression after `@` — an identifier for a
    // plain decorator, a call for a parameterized one (e.g. `@app.route(...)`).
    const expr = child.namedChildren[0];
    if (!expr) return false;
    const text = expr.type === "call" ? expr.childForFieldName("function")?.text : expr.text;
    return text === name;
  });
}

/** Best-effort type inference for an untyped assignment: `self.x = Foo()` → "Foo". No real type checking, just a constructor-call heuristic. */
export function inferTypeFromValue(right: Node | null): string | undefined {
  if (!right || right.type !== "call") return undefined;
  const fn = right.childForFieldName("function");
  if (!fn) return undefined;
  if (fn.type === "identifier") return fn.text;
  if (fn.type === "attribute") return fn.childForFieldName("attribute")?.text;
  return undefined;
}
