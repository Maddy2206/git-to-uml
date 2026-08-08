import fs from "node:fs/promises";
import path from "node:path";

const IGNORED_DIR_SEGMENTS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  ".tox",
  "site-packages",
  ".mypy_cache",
  ".pytest_cache",
]);

/** Recursively finds every `.py` file under `rootDir`, skipping common non-source directories. */
export async function walkPythonFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIR_SEGMENTS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".py")) {
        results.push(full);
      }
    }
  }

  await walk(rootDir);
  return results;
}
