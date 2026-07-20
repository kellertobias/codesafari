---
slug: content
title: Content & Model
summary: Frontmatter loaders and the renderer-neutral type model.
order: 20
---

The authored side of the system. [`src/model/types.ts`](src/model/types.ts)
defines the renderer-neutral [manifest](glossary:manifest) shape shared by the
CLI and the viewer, with no Node or DOM dependencies.

[`src/content/loadContent.ts`](src/content/loadContent.ts) reads and validates
the `.tour/` Markdown — project overview, components, tours, and glossary —
turning each file into a typed object and collecting problems as diagnostics
rather than throwing.
