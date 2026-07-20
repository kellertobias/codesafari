/**
 * CodeViewer — the internal abstraction for the center code pane.
 *
 * v1 renderer: **Code Hike** (`codehike/code`). We call its async `highlight()`
 * primitive directly — no MDX, no React authoring — so authored tours stay
 * pure Markdown while the viewer gets Code Hike's tokenizer, theming, and
 * composable annotation handlers. Pages depend only on {@link CodeViewerProps};
 * swapping renderers means replacing this file alone.
 *
 * Hard requirements this satisfies:
 *   - Full-file display (never isolated snippets) — "sneak around" browsing.
 *   - Preserved line numbers (a `line-numbers` annotation handler).
 *   - Arbitrary scroll-to-range + highlight (a `mark` block annotation injected
 *     for the requested range, plus scroll-into-view on change).
 *   - Monokai theme (Code Hike's bundled `monokai`, offline via onig.wasm).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  highlight,
  Pre,
  InnerLine,
  type AnnotationHandler,
  type HighlightedCode,
} from 'codehike/code';
import type { LineRange } from '../../../src/model/types';
import { CloseIcon } from '../tree/icons';
import './code-viewer.css';

const THEME = 'monokai';

export interface CodeViewerProps {
  /** Full file content — always the complete file, never an isolated snippet. */
  content: string;
  /** Our language id (see languageForPath), or undefined. */
  language?: string;
  /** The focus range: highlighted/scrolled-to (1-based, inclusive). */
  highlight?: LineRange | null;
  /**
   * A wider surrounding range. When present the view enters "detail" mode: this
   * range is banded as context, the focus reads as regular (crisp) text within
   * it, and everything outside is faded.
   */
  context?: LineRange | null;
  /** Path shown in the header. */
  path: string;
  /** When provided, a ✕ close control is shown in the header. */
  onClose?: () => void;
}

function inRange(n: number, r?: LineRange | null): boolean {
  return !!r && n >= r.start && n <= r.end;
}

/** Map our language ids to Code Hike / lighter language names. */
function chLanguage(language?: string): string {
  switch (language) {
    case 'typescript':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'rust':
      return 'rust';
    case 'python':
      return 'python';
    default:
      return 'text';
  }
}

/**
 * Build the per-line handler for the current focus/context ranges. Every line
 * gets a gutter number and a class deciding its emphasis:
 *
 *   - Step mode (no context): the focus range is banded, the rest is normal.
 *   - Detail mode (context set): the context range is banded, the focus reads
 *     as crisp regular text within it, and everything outside is faded.
 */
function buildHandlers(
  focus: LineRange | null | undefined,
  context: LineRange | null | undefined,
): AnnotationHandler[] {
  const detailMode = !!context;
  const handler: AnnotationHandler = {
    name: 'cv-line',
    Line: (props) => {
      const n = props.lineNumber;
      const isFocus = inRange(n, focus);
      let mod = '';
      if (detailMode) {
        mod = isFocus
          ? 'cv-line-focus'
          : inRange(n, context)
            ? 'cv-line-context'
            : 'cv-line-dim';
      } else if (isFocus) {
        mod = 'cv-line-hit';
      }
      const isFocusStart = isFocus && n === focus!.start;
      return (
        <div
          className={`cv-line${mod ? ` ${mod}` : ''}`}
          data-cv-focus={isFocus ? '' : undefined}
          data-cv-mark-start={isFocusStart ? '' : undefined}
        >
          <span className="cv-gutter">{n}</span>
          <InnerLine merge={props} className="cv-content" />
        </div>
      );
    },
  };
  return [handler];
}

// @tour viewer:4 Rendering code with Code Hike
// The end of the line — the component drawing this very pane. It calls Code
// Hike's async `highlight()` on the full file, injects a `mark` block annotation
// for the step's range, and renders through `<Pre>` with two handlers: one for
// line numbers, one for the highlight band. Swapping renderers means changing
// only this file, thanks to the CodeViewer abstraction.
export function CodeViewer({
  content,
  language,
  highlight: range,
  context,
  path,
  onClose,
}: CodeViewerProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks the last rendered path to decide scroll (same file) vs jump (new).
  const lastPathRef = useRef<string | null>(null);
  // Store the tokens together with the content they were computed from, so a
  // pending re-tokenization never lets a new range annotate a stale file's
  // tokens (Code Hike dereferences out-of-range tokens and throws).
  const [tokenized, setTokenized] = useState<{
    content: string;
    result: HighlightedCode;
  } | null>(null);

  // Tokenize the whole file whenever content/language changes.
  useEffect(() => {
    let alive = true;
    highlight({ value: content, lang: chLanguage(language), meta: '' }, THEME)
      .then((result) => {
        if (alive) setTokenized({ content, result });
      })
      .catch(() => {
        if (alive) setTokenized(null);
      });
    return () => {
      alive = false;
    };
  }, [content, language]);

  // Only render once the tokens match the current file. Line emphasis is done
  // by the handlers (by line number), so no annotations are injected.
  const ready = tokenized?.content === content ? tokenized.result : null;
  const codeData = useMemo<HighlightedCode | null>(
    () => (ready ? { ...ready, annotations: [] } : null),
    [ready],
  );

  // Rebuild the per-line handler when the focus/context ranges change.
  const handlers = useMemo(() => buildHandlers(range, context), [range, context]);

  // Scroll to the target. Within the same file we glide (smooth scroll); when
  // switching to a different file (or first paint) we jump. Gated on codeData so
  // the first run with real tokens — not the "Highlighting…" placeholder —
  // decides same-vs-different file.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !codeData) return; // wait for tokens to render
    const sameFile = lastPathRef.current === path;
    lastPathRef.current = path;
    const behavior: ScrollBehavior = sameFile ? 'smooth' : 'auto';

    if (!range) {
      if (!sameFile) scroller.scrollTop = 0;
      return;
    }
    // rAF so the freshly-rendered lines are laid out before we measure.
    const raf = requestAnimationFrame(() => {
      const hits = scroller.querySelectorAll<HTMLElement>('[data-cv-focus]');
      if (hits.length === 0) return;
      const sTop = scroller.getBoundingClientRect().top;
      // Content-absolute top/bottom of the highlighted block.
      const blockTop =
        hits[0].getBoundingClientRect().top - sTop + scroller.scrollTop;
      const blockBottom =
        hits[hits.length - 1].getBoundingClientRect().bottom -
        sTop +
        scroller.scrollTop;
      const blockHeight = blockBottom - blockTop;
      const viewHeight = scroller.clientHeight;

      let top: number;
      if (blockHeight <= viewHeight) {
        // The whole block fits: center it so all of it is on screen.
        top = blockTop - (viewHeight - blockHeight) / 2;
      } else {
        // Taller than the viewport: show the start near the top.
        top = blockTop - Math.min(viewHeight * 0.1, 40);
      }
      scroller.scrollTo({ top: Math.max(0, top), behavior });
    });
    return () => cancelAnimationFrame(raf);
  }, [range, context, path, codeData]);

  return (
    <div className="cv-root">
      <div className="cv-header">
        <span className="cv-path">{path}</span>
        {onClose && (
          <button className="cv-close" onClick={onClose} title="Close file" aria-label="Close file">
            <CloseIcon />
          </button>
        )}
      </div>
      <div className="cv-scroll" ref={scrollRef}>
        {codeData ? (
          <Pre
            className="cv-code"
            code={codeData}
            handlers={handlers}
            style={codeData.style}
          />
        ) : (
          <div className="empty" style={{ padding: 16 }}>
            Highlighting…
          </div>
        )}
      </div>
    </div>
  );
}
