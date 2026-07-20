---
slug: manifest-builder
title: Manifest Builder
summary: Orchestrates content + comments into a validated manifest.
order: 40
---

[`src/manifest/build.ts`](src/manifest/build.ts) is the orchestrator. It loads
content, walks the non-ignored source files (honoring the
[ignore matcher](glossary:ignore-matcher)), scans each for `@tour` comments,
resolves every step's highlight range, attaches steps to their tours in
[dot-aware](glossary:dot-aware-ordering) order, collects
[callouts](glossary:callout), validates cross-references, and — for export —
bundles source content so the site works offline.

The output is a single [manifest](glossary:manifest): the frozen description of
the whole project.
