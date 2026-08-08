import type { Node } from "@git-to-uml/parser-core";
import type { MethodIR, ParamIR } from "@git-to-uml/ir";
import { findModifiers, hasModifier, positionOf, visibilityFromModifiers } from "./astHelpers";

function extractParams(paramsNode: Node | null): ParamIR[] {
  if (!paramsNode) return [];
  const params: ParamIR[] = [];
  for (const child of paramsNode.namedChildren) {
    if (!child) continue;
    if (child.type !== "formal_parameter" && child.type !== "spread_parameter") continue;
    const nameNode = child.childForFieldName("name");
    const typeNode = child.childForFieldName("type");
    if (!nameNode) continue;
    params.push({
      name: child.type === "spread_parameter" ? `...${nameNode.text}` : nameNode.text,
      type: typeNode?.text,
    });
  }
  return params;
}

export function extractMethod(node: Node, classId: string, relFilePath: string): MethodIR {
  const modifiers = findModifiers(node);
  const name = node.childForFieldName("name")!.text;
  return {
    id: `${classId}.${name}`,
    name,
    params: extractParams(node.childForFieldName("parameters")),
    returnType: node.childForFieldName("type")?.text,
    visibility: visibilityFromModifiers(modifiers),
    isStatic: hasModifier(modifiers, "static"),
    // Interface methods with no body are implicitly abstract even without the keyword.
    isAbstract: hasModifier(modifiers, "abstract") || !node.childForFieldName("body"),
    position: positionOf(relFilePath, node),
  };
}

/** Constructors have no return type and are named after the class (Java convention) — otherwise the same shape as a method. */
export function extractConstructor(node: Node, classId: string, relFilePath: string): MethodIR {
  const modifiers = findModifiers(node);
  const name = node.childForFieldName("name")!.text;
  return {
    id: `${classId}.${name}`,
    name,
    params: extractParams(node.childForFieldName("parameters")),
    visibility: visibilityFromModifiers(modifiers),
    position: positionOf(relFilePath, node),
  };
}
