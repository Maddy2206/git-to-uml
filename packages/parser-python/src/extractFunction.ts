import type { Node } from "@git-to-uml/parser-core";
import type { FunctionIR, MethodIR, ParamIR } from "@git-to-uml/ir";
import { positionOf, visibilityFromName } from "./astHelpers";

function extractParams(paramsNode: Node | null): ParamIR[] {
  if (!paramsNode) return [];
  const params: ParamIR[] = [];

  for (const child of paramsNode.namedChildren) {
    if (!child) continue;
    switch (child.type) {
      case "identifier":
        params.push({ name: child.text });
        break;
      case "typed_parameter": {
        // The param name has no field here (unlike default_parameter) — it's
        // the plain identifier child, distinct from the fielded `type:` node.
        const nameNode = child.namedChildren.find((c) => c?.type === "identifier");
        const typeNode = child.childForFieldName("type");
        if (nameNode) params.push({ name: nameNode.text, type: typeNode?.text });
        break;
      }
      case "default_parameter": {
        const nameNode = child.childForFieldName("name");
        if (nameNode) params.push({ name: nameNode.text, optional: true });
        break;
      }
      case "typed_default_parameter": {
        const nameNode = child.childForFieldName("name");
        const typeNode = child.childForFieldName("type");
        if (nameNode) params.push({ name: nameNode.text, type: typeNode?.text, optional: true });
        break;
      }
      case "list_splat_pattern": // *args
      case "dictionary_splat_pattern": // **kwargs
        params.push({ name: child.text });
        break;
      default:
        // positional-only `/` marker, keyword-only `*` marker, etc. — nothing to record
        break;
    }
  }

  return params;
}

/** Extracts a top-level `def` as a FunctionIR. */
export function extractFunction(fnNode: Node, relFilePath: string): FunctionIR {
  const name = fnNode.childForFieldName("name")!.text;
  return {
    id: `${relFilePath}#${name}`,
    name,
    params: extractParams(fnNode.childForFieldName("parameters")),
    returnType: fnNode.childForFieldName("return_type")?.text,
    filePath: relFilePath,
    isExported: true, // Python has no export keyword; every top-level def is importable
    position: positionOf(relFilePath, fnNode),
  };
}

/**
 * Extracts a class-body `def` as a MethodIR. The implicit `self`/`cls` first
 * parameter is dropped for non-static methods — by strong convention it's
 * always present and never a real dependency, so keeping it would just add
 * noise to the rendered signature.
 */
export function extractMethod(fnNode: Node, classId: string, relFilePath: string, isStatic: boolean): MethodIR {
  const name = fnNode.childForFieldName("name")!.text;
  const allParams = extractParams(fnNode.childForFieldName("parameters"));
  const params = isStatic ? allParams : allParams.slice(1);

  return {
    id: `${classId}.${name}`,
    name,
    params,
    returnType: fnNode.childForFieldName("return_type")?.text,
    visibility: visibilityFromName(name),
    isStatic,
    position: positionOf(relFilePath, fnNode),
  };
}
