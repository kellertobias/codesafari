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
  /** Range to highlight and scroll into view (1-based, inclusive). */
  highlight?: LineRange | null;
  /** Path shown in the header. */
  path: string;
  /** When provided, a ✕ close control is shown in the header. */
  onClose?: () => void;
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

/** Prepend a line-number gutter to every line. */
const lineNumbers: AnnotationHandler = {
  name: 'line-numbers',
  Line: (props) => (
    <div className="cv-line">
      <span className="cv-gutter">{props.lineNumber}</span>
      <InnerLine merge={props} className="cv-content" />
    </div>
  ),
};

/**
 * Highlight the lines covered by a `mark` block annotation and tag the first
 * one so the viewer can scroll it into view.
 */
const markRange: AnnotationHandler = {
  name: 'mark',
  onlyIfAnnotated: true,
  Line: ({ annotation, ...props }) => {
    const hit = Boolean(annotation);
    const isStart = hit && props.lineNumber === annotation!.fromLineNumber;
    return (
      <div
        className={hit ? 'cv-line-hit' : undefined}
        data-cv-mark-start={isStart ? '' : undefined}
      >
        <InnerLine merge={props} />
      </div>
    );
  },
};

const HANDLERS = [markRange, lineNumbers];

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
  path,
  onClose,
}: CodeViewerProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Only render once the tokens match the current file.
  const ready = tokenized?.content === content ? tokenized.result : null;

  // Inject a block annotation for the requested range without re-tokenizing.
  const codeData = useMemo<HighlightedCode | null>(() => {
    if (!ready) return null;
    if (!range) return { ...ready, annotations: [] };
    // Clamp to the file's line count as a defensive guard.
    const totalLines = content.split('\n').length;
    const start = Math.max(1, Math.min(range.start, totalLines));
    const end = Math.max(start, Math.min(range.end, totalLines));
    return {
      ...ready,
      annotations: [{ name: 'mark', query: '', fromLineNumber: start, toLineNumber: end }],
    };
  }, [ready, range, content]);

  // Scroll the highlighted band into view whenever the range or file changes.
  useEffect(() => {
    if (!range || !scrollRef.current) return;
    const start = scrollRef.current.querySelector('[data-cv-mark-start]');
    start?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [range, path, codeData]);

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
            handlers={HANDLERS}
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
