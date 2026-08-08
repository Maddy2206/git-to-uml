import path from "node:path";

/** Repo-relative, POSIX-separated path — the canonical module id format used across the IR. */
export function toRelPath(rootDir: string, absPath: string): string {
  const rel = path.relative(rootDir, absPath);
  return rel.split(path.sep).join("/");
}

/** Directory portion of a repo-relative, POSIX-separated path; "." for a root-level file. */
export function dirnameOf(relPath: string): string {
  const idx = relPath.lastIndexOf("/");
  return idx === -1 ? "." : relPath.slice(0, idx);
}
