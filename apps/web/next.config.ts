import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // web-tree-sitter loads its .wasm grammars via plain Node `fs`/`require.resolve`
  // at runtime (see packages/parser-core/src/treeSitterLoader.ts) — webpack's
  // bundler otherwise tries to statically parse the .wasm binary as a JS module
  // and fails ("Unexpected character '\0'"). Marking both packages external
  // keeps them as real `require()` calls resolved by Node directly for
  // server-side code (API routes), untouched by webpack — the officially
  // recommended fix for native/WASM-loading packages in Next.js.
  serverExternalPackages: ["web-tree-sitter", "tree-sitter-wasms"],
  transpilePackages: [
    "@git-to-uml/pipeline",
    "@git-to-uml/ingest",
    "@git-to-uml/ir",
    "@git-to-uml/parser-core",
    "@git-to-uml/parser-ts",
    "@git-to-uml/parser-python",
    "@git-to-uml/parser-java",
    "@git-to-uml/graph",
    "@git-to-uml/layout",
    "@git-to-uml/excalidraw-gen",
  ],
  webpack: (config) => {
    // elkjs (used by @git-to-uml/layout) probes for the optional `web-worker`
    // package via `require.resolve('web-worker')`, guarded by try/catch — a
    // no-op fallback to its synchronous non-worker layout path when absent
    // (which is what we want; the API route runs one short-lived layout
    // computation per request, no real worker thread needed). Plain Node
    // resolves this fine (the catch just swallows it), but webpack's static
    // bundling analysis errors on the unresolvable module, so alias it away.
    config.resolve.alias = { ...config.resolve.alias, "web-worker": false };
    // `serverExternalPackages` above stops normal import/require of these
    // packages from being bundled, but our loader also does
    // `require.resolve('tree-sitter-wasms/out/*.wasm')` (see
    // treeSitterLoader.ts) to get the grammar file's path — webpack's file
    // tracing still follows that and, finding no rule for `.wasm`, falls
    // back to parsing it with the default JS parser, which chokes on the
    // binary. Telling webpack to treat `.wasm` as an opaque asset (just
    // copy it, don't parse it) fixes this regardless of which code path
    // pulled the file in.
    config.module.rules.push({ test: /\.wasm$/, type: "asset/resource" });
    return config;
  },
};

export default nextConfig;
