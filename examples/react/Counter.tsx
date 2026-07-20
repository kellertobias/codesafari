import { useState } from 'react';

// A minimal counter component in React.
//
// The three steps use a doc-block comment, regular line comments, and a ranged
// block comment respectively.

interface CounterProps {
  /** Starting value; defaults to 0. */
  start?: number;
}

/**
 * @tour counter:1 Local state
 * `useState` gives the component one piece of state and a setter. The initial
 * value is only read on the first render — later renders keep the live value.
 *
 * (Anchored with a doc-block `/** ... *\/` comment.)
 */
export function Counter({ start = 0 }: CounterProps) {
  const [count, setCount] = useState(start);

  // @tour counter:2 Updating from the previous value
  // Passing a function to the setter avoids stale reads: React hands you the
  // latest count, so rapid clicks each apply on top of the last.
  //
  // (Anchored with regular `//` line comments.)
  const increment = () => setCount((c) => c + 1);

  /*
   * @tour counter:3 Rendering
   * The returned JSX is a pure function of `count`. Click the button, state
   * changes, React re-renders, and the label reflects the new number.
   *
   * (Anchored with a ranged block `/* ... *\/` comment.)
   */
  return (
    <button type="button" onClick={increment}>
      Clicked {count} times
    </button>
  );
}

/**
 * @tour comment Callouts are a `@tour comment` feature
 * The callout is produced by the `@tour comment` header, independent of the
 * comment style hosting it. A doc block like this is the preferred style, but
 * `//` line comments and `/* ... *\/` blocks work identically.
 *
 * > [!NOTE] Also available in Markdown
 * > Inside any body you can write Obsidian-style admonitions — `> [!NOTE] ...`,
 * > `> [!WARNING] ...` — and the viewer renders them as callout boxes.
 */
