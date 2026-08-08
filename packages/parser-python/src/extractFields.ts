import type { Node } from "@git-to-uml/parser-core";
import type { FieldIR } from "@git-to-uml/ir";
import { inferTypeFromValue, positionOf, visibilityFromName } from "./astHelpers";

function buildField(name: string, assign: Node, classId: string, relFilePath: string): FieldIR {
  const typeNode = assign.childForFieldName("type");
  const rightNode = assign.childForFieldName("right");
  return {
    id: `${classId}.${name}`,
    name,
    type: typeNode ? typeNode.text : inferTypeFromValue(rightNode),
    visibility: visibilityFromName(name),
    position: positionOf(relFilePath, assign),
  };
}

/** Class-body-level attribute: `name = value` or `name: Type = value` directly in the class body. */
export function extractClassLevelField(assign: Node, classId: string, relFilePath: string): FieldIR | null {
  const left = assign.childForFieldName("left");
  if (left?.type !== "identifier") return null;
  return buildField(left.text, assign, classId, relFilePath);
}

/**
 * `self.x = value` (or `self.x: Type = value`) inside a method body. Python
 * has no field declarations outside the class body — this is how a class's
 * "real" fields normally show up, most commonly in `__init__` but not only
 * there, so callers scan every method, not just the constructor.
 */
export function extractSelfField(assign: Node, classId: string, relFilePath: string): FieldIR | null {
  const left = assign.childForFieldName("left");
  if (left?.type !== "attribute") return null;
  const obj = left.childForFieldName("object");
  if (obj?.type !== "identifier" || obj.text !== "self") return null;
  const attrName = left.childForFieldName("attribute")?.text;
  if (!attrName) return null;
  return buildField(attrName, assign, classId, relFilePath);
}
