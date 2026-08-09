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
- ⚛️ **Function-based codebases, not just OOP ones** — React/Next.js components, hooks
  (`useFoo`), and API route handlers are extracted and boxed just like classes are, styled
  by role, with "calls" edges inferred from import/usage — so a typical
  component-and-hooks Next.js repo, which has few or no classes at all, still produces a
  populated class diagram instead of a near-empty one.
- 🧩 **Real UML semantics** — extends (hollow triangle), implements (dashed hollow
  triangle), composition (filled diamond), aggregation (hollow diamond).
- 🗺️ **Two diagram types** — a class diagram (classes/interfaces/enums/components/hooks/
  route handlers and their relationships) and a system architecture diagram (the handful of
  logical components — API gateway, database, cache, auth, pages/routing, ...— you'd draw
  on a whiteboard in a system-design interview, not one box per source file — with
  Next.js-aware conventions for `app/**/route.ts`, `app/**/page.tsx`, root `middleware.ts`,
  and the Pages Router equivalents), switchable via tabs.
- 🤖 **AI-reasoned relationships & components (optional)** — with a `GROQ_API_KEY` set,
  Groq (`llama-3.3-70b-versatile`) reasons over the already-extracted class/module structure
  to judge which UML relationships actually matter and which logical component each file
  belongs to — noticeably better than the regex/token-matching heuristics alone (which are
  still what runs, unchanged, without a key, or if a Groq call fails/times out).
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

Optionally set these in your environment (or `apps/web/.env.local`):
- `GITHUB_TOKEN` — raises the GitHub API rate limit from 60 requests/hour to 5,000/hour.
- `GROQ_API_KEY` — turns on AI-reasoned relationships/component classification (free tier
  at [console.groq.com](https://console.groq.com)). Without it, diagrams still generate
  normally using the heuristics alone.

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
| `packages/ai` | Optional Groq reasoning: judges UML relationships and classifies components, overriding the heuristics above when it succeeds |
| `packages/layout` | `elkjs`-based layout: box sizing, positions, edge routing — shared by both diagram types |
| `packages/excalidraw-gen` | Turns a laid-out graph into Excalidraw scene JSON |
| `packages/pipeline` | Orchestrates ingest → parse → IR (+ optional AI reasoning) → graphs → layout → scenes |

## Testing

```bash
pnpm test        # all packages, via turbo
pnpm typecheck
```

## Roadmap

| Area | Status |
|---|---|
| TypeScript / JavaScript class diagrams | ✅ Shipped |
| Function/component/hook/route-handler diagrams (React, Next.js) | ✅ Shipped |
| Interactive full-screen view | ✅ Shipped |
| System architecture diagram (heuristically classified logical components) | ✅ Shipped |
| Python parsing | ✅ Shipped |
| Java parsing | ✅ Shipped |
| Export to SVG / PNG / `.excalidraw` file | ✅ Shipped |
| AI-reasoned relationships & component classification (Groq) | ✅ Shipped (optional, `GROQ_API_KEY`) |
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
- **Function "calls" edges are import/usage-based, not a real call graph** — a function
  gets a "calls" edge to another function/component/class if it imports it and references
  that name in its own body (this naturally covers JSX usage too — a `<Header />` tag is
  just an identifier reference like any other). It only sees usage *across* files via an
  import, not a function calling another function declared in the same file, and — unlike
  class relationships — it isn't currently reasoned over by the optional AI pass.
- **Architecture-diagram component classification is also a heuristic** — each file is
  bucketed into a component (API/database/cache/auth/...) by its path/filename convention
  (`models/`, `*.controller.ts`, ...) and, failing that, the packages it imports
  (`express` → API, `prisma` → database, ...), falling back to a generic "Application
  Logic" bucket. Unconventional naming or an undetected framework/library can land a file
  in the wrong bucket or the generic one.
- **Public repos only** for now; private-repo support is on the roadmap.
- Repos larger than **~150MB** are rejected by default (configurable in
  `packages/ingest`).
- **AI reasoning silently falls back to the heuristics** whenever it doesn't succeed — no
  `GROQ_API_KEY`, a failed/timed-out call, or a repo over the size guardrails
  (`packages/ai`: 120 classes for relationships, 300 modules for classification). On Groq's
  free tier, its own tokens-per-minute rate limit can also trigger this fallback for
  larger repos even under those guardrails — diagrams still generate normally either way,
  just using the heuristic for whichever part didn't get an AI result.
