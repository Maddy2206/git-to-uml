# git_to_uml

Paste a GitHub repo URL, get back a clean UML class diagram and a high-level
architecture diagram, rendered as an interactive Excalidraw canvas (no mermaid.js).

## Pipeline

```
GitHub URL
   -> [ingest]   fetch repo tarball
   -> [parse]    per-file, per-language -> IR
   -> [ir link]  resolve imports / inheritance / composition
   -> [graph]    class-diagram graph + architecture graph
   -> [layout]   elkjs computes positions + edge routes
   -> [excalidraw-gen] -> Excalidraw scene JSON
   -> apps/web renders it interactively, exports .excalidraw / SVG / PNG
```

See `/home/maddy/.claude/plans/i-want-to-create-quiet-pixel.md` for the full design plan.

## Monorepo layout

- `apps/web` — Next.js app (frontend + API routes)
- `packages/ingest` — GitHub tarball fetch + tmp dir management
- `packages/parser-core` — shared `LanguageParser` interface + tree-sitter WASM loader
- `packages/parser-ts` — TypeScript/JavaScript parser (ts-morph)
- `packages/parser-python` — Python parser (tree-sitter)
- `packages/parser-java` — Java parser (tree-sitter)
- `packages/ir` — language-agnostic IR types + RepoIR builder
- `packages/graph` — class-diagram graph + architecture graph builders
- `packages/layout` — elkjs layout wrappers
- `packages/excalidraw-gen` — IR/graph -> Excalidraw scene JSON
- `packages/pipeline` — orchestrates the full pipeline

## Development

```bash
pnpm install
pnpm dev
```

## Status

**Phase 1 complete**: TypeScript/JavaScript class diagram, end-to-end, verified against a
real public repo ([stemmlerjs/ddd-forum](https://github.com/stemmlerjs/ddd-forum): 250
files, 188 classes, 1320 relationships, 0 overlapping boxes, 0 dangling arrow bindings)
via the running web app.

Not yet built (see the design plan at
`/home/maddy/.claude/plans/i-want-to-create-quiet-pixel.md`):
- Phase 2 — architecture/module diagram (folders as Excalidraw frames, aggregated import edges)
- Phase 3 — Python and Java parsers (`packages/parser-python`, `packages/parser-java`)
- Phase 4 — SVG/PNG/.excalidraw export buttons, private-repo auth, async job queue for large repos, folder-scoped "focus mode"

### Try it

```bash
pnpm install
pnpm --filter @git-to-uml/web dev
# open http://localhost:3000, paste a small public GitHub repo URL (e.g. owner/repo)
```

### Run tests

```bash
pnpm -r test        # 8 packages, 16 tests
pnpm -r typecheck
```
