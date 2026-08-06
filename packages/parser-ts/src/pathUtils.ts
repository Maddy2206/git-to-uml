import path from "node:path";

/** Repo-relative, POSIX-separated path — the canonical module id format used across the IR. */
export function toRelPath(rootDir: string, absPath: string): string {
  const rel = path.relative(rootDir, absPath);
  return rel.split(path.sep).join("/");
}
