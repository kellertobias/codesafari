---
slug: viewer
title: Viewer
summary: The React app — pages, the three-pane runner, and the Code Hike pane.
order: 50
---

The prebuilt React app under `viewer/`, bundled into `viewer-dist/` and shipped
in the package. It loads the [manifest](glossary:manifest) (fetched in `dev`,
inlined in `export`) and renders it.

The centerpiece is the tour runner: a file tree, the
[Code Hike](glossary:code-hike) code pane, and the step panel. Every included
source file is browsable — you can [sneak around](glossary:sneak-around) freely
without losing your place in the tour.

The code pane sits behind an internal `CodeViewer` abstraction so the renderer
can be swapped without touching authored content.
