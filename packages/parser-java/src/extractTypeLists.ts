import type { Node } from "@git-to-uml/parser-core";

/** `implements A, B` / `extends A, B` (interfaces) — the wrapper's single named child is a `type_list` of individual type nodes. */
export function extractTypeListNames(wrapper: Node | null): string[] {
  const typeList = wrapper?.namedChildren.find((c) => c?.type === "type_list");
  if (!typeList) return [];
  return typeList.namedChildren.filter((c): c is Node => c !== null).map((c) => c.text);
}

/** `extends Base` (classes) — the `superclass` wrapper's single child is the base type. */
export function extractSuperclassName(wrapper: Node | null): string | undefined {
  return wrapper?.namedChildren[0]?.text;
}
