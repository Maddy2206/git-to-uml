import type { Node } from "@git-to-uml/parser-core";
import type { ImportEdge } from "@git-to-uml/ir";

/** Flattens a (possibly deeply nested) `scoped_identifier` like `com.example.Foo` into `"com.example.Foo"`. */
function flattenScopedIdentifier(node: Node): string {
  if (node.type === "identifier") return node.text;
  if (node.type === "scoped_identifier") {
    const scope = node.childForFieldName("scope");
    const name = node.childForFieldName("name");
    const scopeText = scope ? flattenScopedIdentifier(scope) : "";
    return scopeText ? `${scopeText}.${name?.text ?? ""}` : (name?.text ?? "");
  }
  return node.text;
}

/** `package com.example.animals;` → `"com.example.animals"`, or null if the file has no package declaration (Java's "default package"). */
export function extractPackageName(programNode: Node): string | null {
  const decl = programNode.namedChildren.find((c) => c?.type === "package_declaration");
  const scopedIdentifier = decl?.namedChildren.find((c) => c?.type === "scoped_identifier" || c?.type === "identifier");
  return scopedIdentifier ? flattenScopedIdentifier(scopedIdentifier) : null;
}

/**
 * A source file's *source root* (e.g. `src/main/java`) is its own directory
 * with its declared package path stripped off the end — Maven/Gradle-style
 * layouts nest the package structure as real directories below a source
 * root that isn't itself part of the package. Knowing it lets absolute
 * imports resolve to real repo-relative file paths instead of just the bare
 * (rootless) dotted package path, which otherwise would never match any
 * real file. Falls back to the file's own directory if the package
 * declaration doesn't actually match the directory structure (unusual, but
 * not worth failing over).
 */
export function computeSourceRoot(currentFileDir: string, packageName: string | null): string {
  if (!packageName) return currentFileDir;
  const packageSegments = packageName.split(".");
  const dirSegments = currentFileDir === "." ? [] : currentFileDir.split("/");
  if (packageSegments.length > dirSegments.length) return currentFileDir;

  const suffix = dirSegments.slice(dirSegments.length - packageSegments.length);
  if (suffix.join("/") !== packageSegments.join("/")) return currentFileDir;

  const rootSegments = dirSegments.slice(0, dirSegments.length - packageSegments.length);
  return rootSegments.length > 0 ? rootSegments.join("/") : ".";
}

/**
 * Extracts an `import_declaration` into an ImportEdge, resolved against
 * `sourceRoot` (see computeSourceRoot). Wildcard imports (`import pkg.*`)
 * are recorded with the package path as `to` — no specific class to point
 * at, so it just harmlessly never resolves, same as an unresolvable
 * third-party import in any other language here. `import static
 * pkg.Class.member` is skipped entirely rather than recorded: its last
 * dotted segment is a *member* name, not a class, so treating it as an
 * import target would point at something that was never a class in the
 * first place.
 */
export function extractImport(node: Node, relFilePath: string, sourceRoot: string): ImportEdge | null {
  // `static` is an anonymous keyword token — a direct (non-named) child of import_declaration.
  const isStatic = node.children.some((c) => c?.type === "static");
  if (isStatic) return null;

  const isWildcard = node.namedChildren.some((c) => c?.type === "asterisk");
  const scopedIdentifier = node.namedChildren.find((c) => c?.type === "scoped_identifier" || c?.type === "identifier");
  if (!scopedIdentifier) return null;

  const dottedPath = flattenScopedIdentifier(scopedIdentifier);
  const slashPath = dottedPath.replace(/\./g, "/");
  const to = sourceRoot === "." ? slashPath : `${sourceRoot}/${slashPath}`;

  return {
    from: relFilePath,
    to,
    specifiers: [isWildcard ? "*" : dottedPath.split(".").pop()!],
    resolved: false,
  };
}
