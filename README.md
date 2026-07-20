# @kobisk/codesafari

Turn a `.tour/` folder plus inline `@tour` source comments into a **local, offline code-tour website**.

`@kobisk/codesafari` is a self-contained TypeScript/React tool you run with `npx`. It reads authored Markdown and inline code comments, builds a manifest of your project's guided tours, and serves them through a VS Code-like read-only viewer with a Monokai theme. It can run live with file watching (`dev`) or emit a fully static, backend-free site (`export`).

> Status: **early development.** The content model, parser, and CLI (`validate`) are the first pieces landing. See [Roadmap](#roadmap).

## Why

Onboarding docs rot because they live away from the code. CodeSafari keeps the *narrative* next to the *source*:

- **Author overviews once** in `.tour/` Markdown (project, components, tours, glossary).
- **Anchor steps to real code** with `@tour slug:step Title` comments that live in the source and move with it.
- **Read it like an IDE** — a file tree, a scrollable read-only code viewer, and a step-by-step tour panel — with the freedom to "sneak around" and explore any file.
- **Ship it anywhere** — `export` produces static HTML/CSS/JS with source bundled in, so the site works offline with no server.

## Install / Run

No install required:

```bash
npx @kobisk/codesafari dev        # live server with file watching (default port 4317)
npx @kobisk/codesafari export     # emit a static site to ./codesafari-site
npx @kobisk/codesafari validate   # check content and report problems
```

Or add it to a project:

```bash
npm install --save-dev @kobisk/codesafari
```

### CLI

| Command | Description |
| --- | --- |
| `codesafari dev [root] --port 4317` | Build the manifest, serve the viewer, watch files, and live-reload. |
| `codesafari export [root] --out codesafari-site` | Write a frozen manifest, bundled source content, and static assets. |
| `codesafari validate [root]` | Parse all content and report errors (bad frontmatter, dangling links, unresolved steps, broken Mermaid). |

`root` defaults to the current directory. It must contain a `.tour/` folder.

## Content model

All authored content lives under `.tour/`. Markdown files use YAML frontmatter.

```
.tour/
  index.md                 # project overview + global defaults
  components/*.md          # software components
  tours/**/*.md            # tour entry pages
  glossary/**/*.md         # glossary concepts (one or many per file)
  examples/**/*.md         # (v1.5) small self-contained code walkthroughs
```

### `.tour/index.md`

```markdown
---
title: My Project
description: What this project is.
defaultSnippetLines: 20
repositoryUrl: https://github.com/me/my-project   # optional
---

Landing-page introduction in Markdown.
```

### Components — `.tour/components/*.md`

```markdown
---
slug: queue-worker
title: Queue Worker
summary: Processes background jobs.   # optional
order: 10                             # optional
---

Description of the component in Markdown.
```

### Tours — `.tour/tours/**/*.md`

```markdown
---
slug: onboarding
title: Onboarding Tour
components: [queue-worker]     # optional
order: 1                       # optional
defaultSnippetLines: 30        # optional; overrides project default
---

Intro shown before the "Start tour" button.
```

### Glossary — `.tour/glossary/**/*.md`

One file may define many concepts using headings. Link to a concept from anywhere with an explicit Markdown link:

```markdown
See the [Queue worker](glossary:queue-worker) for details.
```

## Inline tour comments

Anchor a tour step to code with a comment whose first line is:

```
@tour <tour-slug>:<step-order> <Step title>
```

The rest of the continuous comment block is the step body (full Markdown: inline code, links, images, `glossary:` links, and fenced ```mermaid``` diagrams).

```ts
// @tour onboarding:12.34 Enqueue a job
// The producer pushes work onto the queue. Downstream, the
// [Queue worker](glossary:queue-worker) drains it.
function enqueue(job: Job) { /* ... */ }
```

**Step order is dot-aware numeric.** `12.34` sorts before `12.45`; `12.2` sorts before `12.10`.

**Non-step callouts** render as styled annotations (not navigation steps):

```
// @tour comment Watch out
// This map is not thread-safe.
```

### How a step resolves its highlight

Given a step comment, the target range is chosen by what directly follows it:

- Directly before a **class** → the whole class.
- Directly before a **function/method** → that function/method.
- Directly before another **block** → that block.
- Otherwise → the comment plus the next `defaultSnippetLines` lines (tour-level value overrides the project default).

## Diagrams

Fenced ```` ```mermaid ```` blocks in any `.tour/` Markdown or source-comment body are rendered locally to SVG — on demand during `dev`, and pre-rendered into static assets during `export`. Rendering never touches the network. `validate` reports the file and block for any diagram that fails to render.

## Ignore rules

Files are excluded from parsing, serving, and export using `.gitignore` plus an optional `.codesafariignore` (same syntax). `.tour/` content is always included, even if a broad pattern would otherwise match it. Images referenced from source comments must be project-relative paths that are not ignored.

## Export output

`export` produces a self-contained directory:

- the prebuilt React viewer (HTML/CSS/JS),
- a frozen `manifest.json`,
- bundled readable source-file content,
- pre-rendered diagram SVGs and copied images.

It runs entirely offline and exposes every included source file.

## Languages

v1 parses **TypeScript/TSX, Rust, and Python** via Tree-sitter. Planned next: C/C++, Vue, Go, PHP.

## Roadmap

- **v1** — content model, ignore handling, dot-aware ordering, heuristic parsing, `validate` / `dev` / `export`, React viewer (Monokai), Mermaid diagrams.
- **v1.5** — small self-contained, state-based code **examples** authored in Markdown, attachable to tours, components, glossary concepts, or standalone.

The center code viewer sits behind an internal `CodeViewer` abstraction. **v1 uses [Code Hike](https://codehike.org)** (`codehike/code`): the CLI calls Code Hike's `highlight()` primitive directly, so authored tours stay pure Markdown — no MDX, no React authoring — while the viewer gets Code Hike's tokenizer, Monokai theme, and composable annotation handlers for line numbers and range highlighting. The abstraction keeps the door open to swapping in Monaco later without touching authored content.

### Try it on this repo

This repository tours itself. From the repo root:

```bash
npm run build          # build the core + viewer once
node dist/cli.js dev . # open http://localhost:4317
```

The `.tour/` folder and the `@tour` comments throughout `src/` and `viewer/src/` drive a two-tour walkthrough of the codebase.

## License

MIT © CodeSafari contributors
