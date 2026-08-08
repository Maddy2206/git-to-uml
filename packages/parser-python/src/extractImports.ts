import type { Node } from "@git-to-uml/parser-core";
import type { ImportEdge } from "@git-to-uml/ir";
import { dirnameOf } from "./pathUtils";

/**
 * Resolves `from .sibling import X` / `from ..pkg.sub import X` relative
 * imports to a repo-relative path, without the `.py`/`__init__.py` suffix
 * (the shared `resolveImports` pass in @git-to-uml/ir tries those suffixes
 * against the known module set — see its `candidateSuffixes` list). One
 * leading dot means "this directory"; each additional dot goes up one more
 * parent directory, matching Python's own relative-import semantics.
 */
function resolveRelativeImportPath(currentFileDir: string, dotCount: number, dottedName: string | null): string {
  let baseDir = currentFileDir;
  for (let i = 0; i < dotCount - 1; i++) baseDir = dirnameOf(baseDir);
  const subPath = dottedName ? dottedName.replace(/\./g, "/") : "";
  if (!subPath) return baseDir;
  return baseDir === "." ? subPath : `${baseDir}/${subPath}`;
}

function dottedNameText(node: Node | null): string | null {
  return node?.type === "dotted_name" ? node.text : null;
}

/**
 * Extracts an `import_statement` or `import_from_statement` into zero or
 * more ImportEdges. Absolute imports (`import pkg.module`, `from pkg import
 * X`) are left as dotted-name-with-dots-as-slashes and `resolved: false` —
 * most will be genuine third-party packages that never resolve against the
 * repo's own module set, which is the correct (harmless) outcome; the ones
 * that are actually repo-internal absolute imports (e.g. `from src.models
 * import User`) get picked up by the same shared suffix-matching fallback
 * that handles everything else.
 */
export function extractImports(node: Node, relFilePath: string): ImportEdge[] {
  const currentDir = dirnameOf(relFilePath);
  const edges: ImportEdge[] = [];

  if (node.type === "import_statement") {
    // `import a.b.c` or `import a.b.c as x` — one edge per dotted/aliased name.
    for (const child of node.namedChildren) {
      if (!child) continue;
      if (child.type === "dotted_name") {
        edges.push({ from: relFilePath, to: child.text.replace(/\./g, "/"), specifiers: [child.text], resolved: false });
      } else if (child.type === "aliased_import") {
        const dotted = dottedNameText(child.childForFieldName("name"));
        if (dotted) edges.push({ from: relFilePath, to: dotted.replace(/\./g, "/"), specifiers: [child.childForFieldName("alias")?.text ?? dotted], resolved: false });
      }
    }
    return edges;
  }

  if (node.type === "import_from_statement") {
    const moduleNameNode = node.childForFieldName("module_name");
    if (!moduleNameNode) return edges;

    const specifiers: string[] = [];
    for (const nameNode of node.childrenForFieldName("name")) {
      if (!nameNode) continue;
      if (nameNode.type === "dotted_name") specifiers.push(nameNode.text);
      else if (nameNode.type === "aliased_import") specifiers.push(nameNode.childForFieldName("alias")?.text ?? nameNode.text);
    }
    if (specifiers.length === 0) specifiers.push("*"); // wildcard_import, or a bare `from . import x` we couldn't otherwise name

    let to: string;
    if (moduleNameNode.type === "relative_import") {
      const prefix = moduleNameNode.namedChildren.find((c) => c?.type === "import_prefix");
      const dotted = moduleNameNode.namedChildren.find((c) => c?.type === "dotted_name");
      const dotCount = prefix?.text.length ?? 1;
      to = resolveRelativeImportPath(currentDir, dotCount, dotted?.text ?? null);
    } else {
      to = moduleNameNode.text.replace(/\./g, "/");
    }

    edges.push({ from: relFilePath, to, specifiers, resolved: false });
  }

  return edges;
}
