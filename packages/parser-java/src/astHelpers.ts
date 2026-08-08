import type { Node } from "@git-to-uml/parser-core";
import type { Position, Visibility } from "@git-to-uml/ir";

export function positionOf(relFilePath: string, node: Node): Position {
  return { file: relFilePath, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1 };
}

/**
 * `modifiers` (when present at all) is an *unfielded* child of
 * class/interface/enum/field/method/constructor declaration nodes — not
 * accessible via `childForFieldName("modifiers")`, confirmed against the
 * real grammar (see the design plan / commit history for how this was
 * verified). Individual keywords like `public`/`static`/`abstract` are
 * themselves anonymous tokens, so they only show up via `.children`
 * (which includes anonymous nodes), not `.namedChildren`.
 */
export function findModifiers(node: Node): Node | null {
  return node.namedChildren.find((c) => c?.type === "modifiers") ?? null;
}

export function hasModifier(modifiers: Node | null, keyword: string): boolean {
  if (!modifiers) return false;
  return modifiers.children.some((c) => c?.type === keyword);
}

/** Java's real four-way visibility, unlike TS/Python's naming-convention approximations — `package` (no modifier) is Java's actual default. */
export function visibilityFromModifiers(modifiers: Node | null): Visibility {
  if (hasModifier(modifiers, "private")) return "private";
  if (hasModifier(modifiers, "protected")) return "protected";
  if (hasModifier(modifiers, "public")) return "public";
  return "package";
}
