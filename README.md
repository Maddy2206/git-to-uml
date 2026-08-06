# git_to_uml

Paste a GitHub repo URL, get back a clean UML class diagram — rendered as a hand-drawn,
fully interactive, **editable** [Excalidraw](https://excalidraw.com) canvas. No mermaid.js
anywhere; every diagram is a real Excalidraw scene you can drag, edit, and export.

## Features

- 🔎 **Just paste a URL** — `owner/repo`, a full `https://github.com/...` link, or a
  `/tree/<branch>` link all work. No local clone needed.
- 🧩 **Real UML semantics** — extends (hollow triangle), implements (dashed hollow
  triangle), composition (filled diamond), aggregation (hollow diamond). Relationships are
  inferred from constructor-injected fields and method return types too, not just
  explicitly declared properties.
- ✏️ **Fully interactive** — pan, zoom, drag boxes, edit text, regroup — it's a live
  Excalidraw scene, not a static image.
- 🖥️ **Full-screen view** — open any generated diagram in its own tab for a bigger canvas.
- 📐 **Auto-layout** — [elkjs](https://github.com/kieler/elkjs) computes a clean, layered,
  non-overlapping layout with orthogonal edge routing; nothing to arrange by hand.
- ⚡ **TypeScript/JavaScript today** — deep, type-aware parsing via
  [ts-morph](https://ts-morph.com); more languages are on the roadmap (see below).

## How it works

```
GitHub URL
   │
   ▼
 ingest         fetch the repo as a tarball (no git clone)
   │
   ▼
 parse          per-file, per-language → language-agnostic IR
   │
   ▼
 ir link        resolve imports / inheritance / composition
   │
   ▼
 graph          build the class-diagram graph
   │
   ▼
 layout         elkjs computes box positions + edge routes
   │
   ▼
 excalidraw-gen laid-out graph → Excalidraw scene JSON
   │
   ▼
 apps/web       renders it as a live, interactive canvas
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
| `packages/parser-core` | Shared `LanguageParser` interface + tree-sitter WASM loader, for future languages |
| `packages/parser-python` / `packages/parser-java` | Not yet implemented — see [Roadmap](#roadmap) |
| `packages/graph` | Builds the class-diagram graph from the IR |
| `packages/layout` | `elkjs`-based layout: box sizing, positions, edge routing |
| `packages/excalidraw-gen` | Turns a laid-out graph into Excalidraw scene JSON |
| `packages/pipeline` | Orchestrates ingest → parse → IR → graph → layout → scene |

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
| Python parsing | 🚧 Planned (`packages/parser-python`) |
| Java parsing | 🚧 Planned (`packages/parser-java`) |
| Architecture / module diagram (folders as frames, import graph) | 🚧 Planned |
| Export to SVG / PNG / `.excalidraw` file | 🚧 Planned |
| Private repo support (GitHub OAuth) | 🚧 Planned |
| Async processing for very large repos | 🚧 Planned |
| Folder-scoped "focus mode" for large diagrams | 🚧 Planned |

## Known limitations

- **Composition/aggregation edges are a heuristic**, not a full type-checker resolution —
  they're inferred by matching field/parameter/return-type names against known classes.
  This works well in practice but can occasionally miss a relationship (types inferred
  without an explicit annotation) or point at the wrong class of the same name in an
  unrelated file.
- **Public repos only** for now; private-repo support is on the roadmap.
- Repos larger than **~150MB** are rejected by default (configurable in
  `packages/ingest`).
