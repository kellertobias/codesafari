---
slug: viewer
title: How the viewer renders a tour
components: [viewer]
order: 2
defaultSnippetLines: 22
---

The backend hands the frontend a single [manifest](glossary:manifest). This tour
follows what the React app does with it: load the manifest, route to the running
tour, lay out the three panes, and render code through
[Code Hike](glossary:code-hike).

It ends inside `CodeViewer` — the exact component drawing the Monokai pane you're
reading this in right now.
