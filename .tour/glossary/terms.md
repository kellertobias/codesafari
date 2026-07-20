## Manifest

The single, frozen description of a CodeSafari project — project metadata,
components, tours (with their resolved steps), glossary concepts, callouts, and,
in exports, bundled source content. It's produced by `buildManifest()` and is
the only contract between the CLI and the React viewer. Its shape lives in
[`src/model/types.ts`](src/model/types.ts) and carries no Node or DOM
dependencies so both sides can share it.

## Dot-aware ordering

Step order keys like `12.34` are **not** decimal numbers — each dot-separated
segment is compared as its own integer. So `12.2` sorts before `12.10`, and
`12` sorts before `12.1`. This lets you insert steps between existing ones
without renumbering. Implemented in [`src/parser/ordering.ts`](src/parser/ordering.ts).

## Anchor resolution

The rule that turns a step comment into a highlight range. If a class follows
the comment, the whole class is highlighted; a function or method highlights
that function; another block highlights the block; otherwise the comment plus
`defaultSnippetLines` lines are shown. Brace-matching handles C-like languages
and indentation handles Python. See
[`src/parser/resolveTarget.ts`](src/parser/resolveTarget.ts).

## Ignore matcher

Combines `.gitignore` and `.codesafariignore` (both gitignore syntax) to decide
which files are parsed, served, and bundled. `.tour/` content is always kept,
even when a broad pattern like `*.md` would otherwise match it. Implemented in
[`src/ignore/ignore.ts`](src/ignore/ignore.ts).

## Callout

A non-navigable, styled source annotation written as `@tour comment <title>`.
Unlike a step, it never appears in the tour's next/previous navigation; instead
it's shown alongside the file it annotates. Great for "watch out" notes.

## Code Hike

The v1 renderer behind the `CodeViewer` abstraction. CodeSafari calls Code Hike's
`highlight()` primitive directly (no MDX, no React authoring), then renders the
result with its `<Pre>` component and composable annotation handlers for line
numbers and range highlighting. Themed with Monokai and fully offline.

## Sneak around

The ability to open any included source file from the tree and scroll through it
freely — inspecting code near, or well away from, the current step — without
changing your place in the tour. Selecting a step re-attaches the code pane to
that step's file and range.
