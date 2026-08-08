# git_to_uml

Paste a GitHub repo URL, get back a clean UML class diagram **and** a high-level
architecture diagram — rendered as hand-drawn, fully interactive, **editable**
[Excalidraw](https://excalidraw.com) canvases. No mermaid.js anywhere; every diagram is a
real Excalidraw scene you can drag, edit, and export.

## Features

- 🔎 **Just paste a URL** — `owner/repo`, a full `https://github.com/...` link, or a
  `/tree/<branch>` link all work. No local clone needed.
- 🌐 **Multi-language** — TypeScript/JavaScript, Python, and Java, parsed in the same pass
  and merged into one diagram for mixed-language repos.
- 🧩 **Real UML semantics** — extends (hollow triangle), implements (dashed hollow
  triangle), composition (filled diamond), aggregation (hollow diamond). Relationships are
  inferred from constructor-injected fields and method return types too, not just
  explicitly declared properties.
- 🗺️ **Two diagram types** — a class diagram (classes/interfaces/enums and their
  relationships) and a system architecture diagram (the handful of logical components —
  API gateway, database, cache, auth, ...— you'd draw on a whiteboard in a system-design
  interview, not one box per source file), switchable via tabs.
- ✏️ **Fully interactive** — pan, zoom, drag boxes, edit text, regroup — it's a live
  Excalidraw scene, not a static image.
- 🖥️ **Full-screen view** — open any generated diagram in its own tab for a bigger canvas.
- ⬇️ **Export** — download the live scene as `.excalidraw` (open it in the real Excalidraw
  app), SVG, or PNG, right from the canvas toolbar.
- 📐 **Auto-layout** — [elkjs](https://github.com/kieler/elkjs) computes a clean, layered,
  non-overlapping layout with orthogonal edge routing; nothing to arrange by hand.

## How it works

```
GitHub URL
   │
   ▼
 ingest         fetch the repo as a tarball (no git clone)
   │
   ▼
 parse          per-file, per-language (TS/JS, Python, Java) → language-agnostic IR
   │
   ▼
 ir link        resolve imports / inheritance / composition
   │
   ▼
 graph          build the class-diagram graph + the architecture graph
   │
   ▼
 layout         elkjs computes box positions + edge routes
   │
   ▼
 excalidraw-gen laid-out graphs → Excalidraw scene JSON
   │
   ▼
 apps/web       renders both as live, interactive canvases
```

Every stage above is a pure function on plain data, which is what makes adding a new
source language or diagram type additive rather than a rewrite.

## Quick start

**Prerequisites:** Node ≥ 18, [pnpm](https://pnpm.io)

```bash
git clone <this-repo>
cd git_to_uml
pnpm install
pnpm --filter @git-to-uml/web dev
```

Open [http://localhost:3000](http://localhost:3000), paste a public GitHub repo URL, and
click **Generate**.

Optionally set `GITHUB_TOKEN` in your environment (or `apps/web/.env.local`) to raise the
GitHub API rate limit from 60 requests/hour to 5,000/hour — useful if you're generating
diagrams often.

## Project structure

A pnpm/Turborepo monorepo — each pipeline stage is its own package with a narrow,
testable interface:

| Package | Responsibility |
|---|---|
| `apps/web` | Next.js frontend + API route that drives the pipeline |
| `packages/ingest` | Fetches a GitHub repo as a tarball, manages the temp directory |
| `packages/ir` | Language-agnostic intermediate representation + `RepoIR` builder (import/inheritance/composition resolution) |
| `packages/parser-ts` | TypeScript/JavaScript parser (`ts-morph`) |
| `packages/parser-core` | Shared tree-sitter WASM grammar loader used by the parser-python/parser-java packages |
| `packages/parser-python` | Python parser (tree-sitter) |
| `packages/parser-java` | Java parser (tree-sitter) |
| `packages/graph` | Builds the class-diagram graph and the architecture graph — the latter heuristically classifies each file into a logical component (API/database/cache/...) and aggregates imports between components |
| `packages/layout` | `elkjs`-based layout: box sizing, positions, edge routing — shared by both diagram types |
| `packages/excalidraw-gen` | Turns a laid-out graph into Excalidraw scene JSON |
| `packages/pipeline` | Orchestrates ingest → parse → IR → graphs → layout → scenes |

## Testing

```bash
pnpm test        # all packages, via turbo
pnpm typecheck
```

## Roadmap

| Area | Status |
|---|---|
| TypeScript / JavaScript class diagrams | ✅ Shipped |
| Interactive full-screen view | ✅ Shipped |
| System architecture diagram (heuristically classified logical components) | ✅ Shipped |
| Python parsing | ✅ Shipped |
| Java parsing | ✅ Shipped |
| Export to SVG / PNG / `.excalidraw` file | ✅ Shipped |
| Private repo support (GitHub OAuth) | 🚧 Planned |
| Async processing for very large repos | 🚧 Planned |
| Folder-scoped "focus mode" for large diagrams | 🚧 Planned |

## Known limitations

- **Composition/aggregation edges are a heuristic**, not a full type-checker resolution —
  they're inferred by matching field/parameter/return-type names against known classes.
  This works well in practice but can occasionally miss a relationship (types inferred
  without an explicit annotation) or point at the wrong class of the same name in an
  unrelated file.
- **Cross-language relationships aren't resolved** — a Python class referencing a Java
  class (or similar) won't get an edge; each language's classes/imports are only matched
  against classes/files from the same language.
- **Architecture-diagram component classification is also a heuristic** — each file is
  bucketed into a component (API/database/cache/auth/...) by its path/filename convention
  (`models/`, `*.controller.ts`, ...) and, failing that, the packages it imports
  (`express` → API, `prisma` → database, ...), falling back to a generic "Application
  Logic" bucket. Unconventional naming or an undetected framework/library can land a file
  in the wrong bucket or the generic one.
- **Public repos only** for now; private-repo support is on the roadmap.
- Repos larger than **~150MB** are rejected by default (configurable in
  `packages/ingest`).
