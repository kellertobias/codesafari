---
slug: parser
title: Parser
summary: Comment scanning, dot-aware ordering, and highlight resolution.
order: 30
---

The bridge from raw source text to tour steps. Three focused modules:

- [`comments.ts`](src/parser/comments.ts) — a language-agnostic scanner that
  groups `//`, `#`, and `/* */` runs into blocks and reads the `@tour` header.
- [`ordering.ts`](src/parser/ordering.ts) — [dot-aware ordering](glossary:dot-aware-ordering)
  so `12.2` sorts before `12.10`.
- [`resolveTarget.ts`](src/parser/resolveTarget.ts) — [anchor resolution](glossary:anchor-resolution):
  given the code after a comment, pick the class, function, block, or a snippet
  fallback to highlight.
