# Examples

One tiny, self-contained project per language CodeSafari supports. Each is a
minimal program annotated with inline `@tour` comments, and each has a matching
tour entry page under [`.tour/tours/`](../.tour/tours) — so they show up as real,
navigable tours when you run CodeSafari at the repo root.

## Try them

From the repository root:

```bash
npm run safari        # or: npx @tobisk/codesafari dev
```

The overview lists CodeSafari's own two tours plus the five per-language
examples below. Open any of them to step through its source.

## What's here

| Folder | Language | Tour slug | Demo |
| --- | --- | --- | --- |
| [`typescript/`](typescript/fizzbuzz.ts) | TypeScript | `fizzbuzz` | FizzBuzz |
| [`javascript/`](javascript/todo.js) | JavaScript | `todo` | In-memory todo list |
| [`react/`](react/Counter.tsx) | React (TSX) | `counter` | `useState` counter |
| [`python/`](python/temperature.py) | Python | `temp` | Temperature converter |
| [`rust/`](rust/src/main.rs) | Rust | `wordcount` | Word-frequency counter |

Each folder is a stand-alone program that also runs on its own. They stay tiny —
one small feature each — so the tour narrative is easy to follow.

## Comment styles

The examples double as a reference for every comment shape CodeSafari can anchor
a step (or callout) to:

| Style | C-family (TS / JS / TSX / Rust) | Python |
| --- | --- | --- |
| Regular line | `// ...` | `# ...` |
| Ranged block | `/* ... */` | *(folds into the docstring)* |
| Doc block | `/** ... */` | `""" ... """` docstring |

Python has no `/* */`, so its triple-quoted docstring stands in for both the
ranged and doc-block forms. Open any example and you'll see each step labelled
with the style it uses.

## Callouts

There are two ways to add a callout — a highlighted note — and neither is tied
to a particular comment style:

1. **`@tour comment <Title>`** — a header, like a step but non-navigable. It
   produces a note pinned to that spot in the file. It's a feature of the header,
   so it works in any comment style; a **doc block is the preferred host**. Every
   example ends with one.
2. **Obsidian-style Markdown admonitions** inside any body text — write
   `> [!NOTE] Title`, `> [!TIP] …`, `> [!WARNING] …`, etc., and the viewer
   renders them as callout boxes (colour-coded by type).

## How a tour attaches

Two halves make each example a tour:

1. **Inline `@tour <slug>:<step> <title>` comments** in the source, which become
   the navigable steps anchored to the code that follows them.
2. **A tour entry page** at `.tour/tours/example-<language>.md` whose
   frontmatter `slug` matches the comments' slug, supplying the title and intro.

To add another example, drop a source file here with `@tour` comments and add a
matching entry page under `.tour/tours/`.
