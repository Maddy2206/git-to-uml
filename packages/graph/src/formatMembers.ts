import type { FieldIR, MethodIR, Visibility } from "@git-to-uml/ir";

const VISIBILITY_SYMBOL: Record<Visibility, string> = {
  public: "+",
  private: "-",
  protected: "#",
  package: "~",
};

export function formatField(field: FieldIR): string {
  const symbol = VISIBILITY_SYMBOL[field.visibility];
  const staticMark = field.isStatic ? " (static)" : "";
  const type = field.type ? `: ${field.type}` : "";
  return `${symbol} ${field.name}${type}${staticMark}`;
}

export function formatMethod(method: MethodIR): string {
  const symbol = VISIBILITY_SYMBOL[method.visibility];
  const params = method.params.map((p) => `${p.name}${p.optional ? "?" : ""}${p.type ? `: ${p.type}` : ""}`).join(", ");
  const returnType = method.returnType ? `: ${method.returnType}` : "";
  const abstractMark = method.isAbstract ? " (abstract)" : "";
  return `${symbol} ${method.name}(${params})${returnType}${abstractMark}`;
}
