import type { Node } from "@git-to-uml/parser-core";
import type { ClassIR, FieldIR, MethodIR } from "@git-to-uml/ir";
import { findModifiers, hasModifier, positionOf } from "./astHelpers";
import { extractEnumConstant, extractFieldDeclaration } from "./extractFields";
import { extractConstructor, extractMethod } from "./extractMethod";
import { extractSuperclassName, extractTypeListNames } from "./extractTypeLists";

function extractMembers(body: Node | null, classId: string, relFilePath: string): { fields: FieldIR[]; methods: MethodIR[] } {
  const fields: FieldIR[] = [];
  const methods: MethodIR[] = [];

  for (const member of body?.namedChildren ?? []) {
    if (!member) continue;
    switch (member.type) {
      case "field_declaration":
        fields.push(...extractFieldDeclaration(member, classId, relFilePath));
        break;
      case "method_declaration":
        methods.push(extractMethod(member, classId, relFilePath));
        break;
      case "constructor_declaration":
        methods.push(extractConstructor(member, classId, relFilePath));
        break;
      default:
        // Nested classes/interfaces/enums, static/instance initializer blocks — not scanned for MVP.
        break;
    }
  }

  return { fields, methods };
}

export function extractClass(node: Node, relFilePath: string): ClassIR {
  const modifiers = findModifiers(node);
  const name = node.childForFieldName("name")!.text;
  const id = `${relFilePath}#${name}`;
  const { fields, methods } = extractMembers(node.childForFieldName("body"), id, relFilePath);

  const superclassName = extractSuperclassName(node.childForFieldName("superclass"));

  return {
    id,
    kind: "class",
    name,
    filePath: relFilePath,
    isAbstract: hasModifier(modifiers, "abstract"),
    isExported: true, // Java has no file-scope export concept; per-member visibility is already captured on each field/method
    fields,
    methods,
    extends: superclassName ? [superclassName] : [],
    implements: extractTypeListNames(node.childForFieldName("interfaces")),
    position: positionOf(relFilePath, node),
    language: "java",
  };
}

export function extractInterface(node: Node, relFilePath: string): ClassIR {
  const name = node.childForFieldName("name")!.text;
  const id = `${relFilePath}#${name}`;
  const { fields, methods } = extractMembers(node.childForFieldName("body"), id, relFilePath);

  // Unlike class_declaration's `superclass`/`interfaces`, an interface's own
  // `extends A, B` list has no field name — it's a bare `extends_interfaces` child.
  const extendsWrapper = node.namedChildren.find((c) => c?.type === "extends_interfaces") ?? null;

  return {
    id,
    kind: "interface",
    name,
    filePath: relFilePath,
    isExported: true,
    fields,
    methods,
    extends: extractTypeListNames(extendsWrapper),
    implements: [],
    position: positionOf(relFilePath, node),
    language: "java",
  };
}

export function extractEnum(node: Node, relFilePath: string): ClassIR {
  const name = node.childForFieldName("name")!.text;
  const id = `${relFilePath}#${name}`;
  const body = node.childForFieldName("body");

  const fields: FieldIR[] = [];
  const methods: MethodIR[] = [];

  for (const child of body?.namedChildren ?? []) {
    if (!child) continue;
    if (child.type === "enum_constant") {
      fields.push(extractEnumConstant(child, id, relFilePath));
    } else if (child.type === "enum_body_declarations") {
      // Members after the `;` in `enum Foo { A, B; <members> }`.
      const extra = extractMembers(child, id, relFilePath);
      fields.push(...extra.fields);
      methods.push(...extra.methods);
    }
  }

  return {
    id,
    kind: "enum",
    name,
    filePath: relFilePath,
    isExported: true,
    fields,
    methods,
    extends: [],
    implements: extractTypeListNames(node.childForFieldName("interfaces")),
    position: positionOf(relFilePath, node),
    language: "java",
  };
}
