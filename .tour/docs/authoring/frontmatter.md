---
title: Frontmatter reference
order: 2
---

Every field is optional — a doc page with no frontmatter at all is valid.

| Field | Effect |
| --- | --- |
| `title` | The page heading. Defaults to the leading `# Heading`, then the humanized file name. |
| `navTitle` | A shorter label for the navigation tree only. Defaults to `title`. |
| `order` | Sort key among siblings. Unordered pages sort last, alphabetically. |

## Titles

The three fallbacks exist so the common case needs no ceremony:

```markdown
# The event loop

Prose starts here.
```

That page is titled "The event loop", and the heading is stripped from the body
so the page doesn't render it twice. Set `title` explicitly when you want the
navigation to read differently from the prose, or `navTitle` when only the tree
label should be shorter.

> [!TIP]
> Use `navTitle` for sections whose real titles are sentences — "How the build
> pipeline fits together" reads well as a page heading and badly as a 200px-wide
> sidebar row.
