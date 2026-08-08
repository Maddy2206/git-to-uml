import type { Node } from "@git-to-uml/parser-core";
import type { FieldIR } from "@git-to-uml/ir";
import { findModifiers, hasModifier, positionOf, visibilityFromModifiers } from "./astHelpers";

/** `[modifiers] Type declarator[, declarator...];` — one field_declaration can declare multiple names sharing the same type/modifiers (`int x, y;`), hence multiple `declarator:` fields. */
export function extractFieldDeclaration(node: Node, classId: string, relFilePath: string): FieldIR[] {
  const modifiers = findModifiers(node);
  const typeNode = node.childForFieldName("type");
  const visibility = visibilityFromModifiers(modifiers);
  const isStatic = hasModifier(modifiers, "static");
  const isReadonly = hasModifier(modifiers, "final");

  const fields: FieldIR[] = [];
  for (const declarator of node.childrenForFieldName("declarator")) {
    const nameNode = declarator?.childForFieldName("name");
    if (!nameNode) continue;
    fields.push({
      id: `${classId}.${nameNode.text}`,
      name: nameNode.text,
      type: typeNode?.text,
      visibility,
      isStatic,
      isReadonly,
      position: positionOf(relFilePath, node),
    });
  }
  return fields;
}

/** `RED, GREEN, BLUE;` inside an enum body — each constant becomes a public field, matching parser-ts's enum handling. */
export function extractEnumConstant(node: Node, classId: string, relFilePath: string): FieldIR {
  const name = node.childForFieldName("name")!.text;
  return {
    id: `${classId}.${name}`,
    name,
    visibility: "public",
    position: positionOf(relFilePath, node),
  };
}
