// A tiny FizzBuzz in TypeScript.
//
// This example uses all three comment styles CodeSafari understands:
//   - a doc-block comment  (/** ... */)
//   - a regular line comment  (// ...)
//   - a ranged block comment  (/* ... */)

/**
 * @tour fizzbuzz:1 The classifier
 * Maps a single number to its FizzBuzz word, or the number itself. Divisibility
 * by 15 has to be checked first — otherwise multiples of 15 would stop at "Fizz".
 *
 * This step is anchored with a **doc-block** comment (`/** ... *\/`).
 */
function classify(n: number): string {
  if (n % 15 === 0) return 'FizzBuzz';
  if (n % 3 === 0) return 'Fizz';
  if (n % 5 === 0) return 'Buzz';
  return String(n);
}

/*
 * @tour fizzbuzz:2 Driving the range
 * The entry point walks 1..limit and prints each classification. Everything
 * interesting lives in `classify`; this is just the loop around it.
 *
 * This step is anchored with a **ranged block** comment (`/* ... *\/`).
 */
export function fizzbuzz(limit: number): void {
  for (let n = 1; n <= limit; n++) {
    console.log(classify(n));
  }
}

/**
 * @tour comment Why 15 and not 3 × 5?
 * `@tour comment` marks a **callout** — a non-navigable note pinned to this
 * spot in the file. It's a feature of the `@tour comment` header, not of any
 * particular comment style: you can write it in a doc block (as here, the
 * preferred style), a `//` line run, or a `/* ... *\/` block. Checking 15 first
 * is just "divisible by both 3 and 5", cheaper to read.
 *
 * > [!TIP] Obsidian-style callouts
 * > Inside any step or callout body you can also use Markdown admonitions like
 * > this one — `> [!TIP] Title` — and the viewer renders them as callout boxes.
 */

fizzbuzz(15);
