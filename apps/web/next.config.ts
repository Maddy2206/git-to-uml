import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: [
    "@git-to-uml/pipeline",
    "@git-to-uml/ingest",
    "@git-to-uml/ir",
    "@git-to-uml/parser-ts",
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
    return config;
  },
};

export default nextConfig;
