import path from "node:path";
import nodeModule from "node:module";
import { Language, Parser } from "web-tree-sitter";

/**
 * Resolves a bare module specifier to a real filesystem path.
 *
 * This one line has been surprisingly hard to get right across every
 * environment this code runs in:
 *  - `createRequire(import.meta.url).resolve(...)` works under plain Node
 *    and Vite/vitest, but under Next.js's webpack bundling of this
 *    (transpiled) package two things break: the *named* `{ createRequire }`
 *    import from `node:module` comes back non-callable (an ESM/CJS interop
 *    artifact — fixed below by using the default import instead), and
 *    `import.meta.url` inside bundled code doesn't point at a real
 *    filesystem location with the expected `node_modules` ancestry (fixed
 *    below by anchoring at `process.cwd()`, a true OS-process property
 *    unaffected by bundling, instead).
 *  - `import.meta.resolve(...)` avoids the interop issue but Vite's SSR
 *    transform doesn't implement it at all, breaking `vitest`.
 */
function resolvePath(specifier: string): string {
  const anchor = path.join(process.cwd(), "package.json");
  return nodeModule.createRequire(anchor).resolve(specifier);
}

let coreInit: Promise<void> | null = null;

/** Initializes the tree-sitter WASM runtime itself (once per process). */
function ensureCoreInitialized(): Promise<void> {
  if (!coreInit) {
    const corePath = resolvePath("web-tree-sitter/tree-sitter.wasm");
    // `locateFile` is Emscripten's hook for finding the runtime .wasm; we
    // always want our resolved node_modules path regardless of what
    // filename it asks for.
    coreInit = Parser.init({ locateFile: () => corePath } as Parameters<typeof Parser.init>[0]);
  }
  return coreInit;
}

const languageCache = new Map<string, Promise<Language>>();

/**
 * Loads (and caches) a tree-sitter grammar from the `tree-sitter-wasms`
 * prebuilt-grammar package by name, e.g. `loadLanguage("python")`,
 * `loadLanguage("java")`. Prebuilt grammars avoid needing an emscripten
 * toolchain in CI to compile one from source.
 */
export async function loadLanguage(grammarName: string): Promise<Language> {
  await ensureCoreInitialized();
  let cached = languageCache.get(grammarName);
  if (!cached) {
    const wasmPath = resolvePath(`tree-sitter-wasms/out/tree-sitter-${grammarName}.wasm`);
    cached = Language.load(wasmPath);
    languageCache.set(grammarName, cached);
  }
  return cached;
}

/** Loads the named grammar and returns a ready-to-use Parser for it. */
export async function createTreeSitterParser(grammarName: string): Promise<Parser> {
  const language = await loadLanguage(grammarName);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}
