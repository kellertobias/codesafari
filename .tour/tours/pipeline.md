---
slug: pipeline
title: How a manifest is built
components: [cli, content, parser, manifest-builder]
order: 1
defaultSnippetLines: 20
---

Follow a single command — `codesafari validate` — from the moment you press enter
down to the cross-reference checks that decide whether your project is sound.

Along the way you'll see how the CLI dispatches commands, how authored Markdown
is loaded, how inline `@tour` comments are scanned out of source, and how each
step's highlight range is resolved from the code that follows it.

Watch the step numbers in the overview: step **3.2** comes before **3.10**, not
after — that's [dot-aware ordering](glossary:dot-aware-ordering) at work.
