---
navTitle: Authoring
order: 1
---

# Authoring documentation pages

Drop any Markdown file under `.tour/docs/` and it becomes a page in the
documentation tree. Nothing else is required — no frontmatter, no registration.

## Structure comes from folders

Every folder is a node in the navigation tree, recursively:

```
.tour/docs/
  index.md                      → the Docs landing page
  authoring/
    index.md                    → the "Authoring" section's own page
    frontmatter.md              → nested beneath it
  deployment.md                 → a top-level page
```

A folder's `index.md` becomes that folder's own page, so a section can have
prose of its own as well as children. A folder without one is a pure grouping
node, labelled from the folder name.

## Slugs and links

A page's slug is its path under `.tour/docs/` without the extension —
`authoring/frontmatter.md` is `authoring/frontmatter`. Link to it from any
Markdown in the project with the `doc:` scheme, exactly like `glossary:`:

```markdown
See [the frontmatter reference](doc:authoring/frontmatter).
```

Broken `doc:` links are reported by `codesafari validate`, so a renamed page
can't quietly orphan the links pointing at it.

See [frontmatter](doc:authoring/frontmatter) for the optional fields.
