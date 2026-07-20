/**
 * CodeViewer — the internal abstraction for the center code pane.
 *
 * The spec calls for evaluating Code Hike and Monaco behind a single
 * `CodeViewer` boundary. This is that boundary: pages depend only on the
 * {@link CodeViewerProps} contract, never on the renderer. v1 ships a
 * lightweight highlight.js-based renderer that satisfies the hard requirements —
 * full-file display, preserved line numbers, free scrolling ("sneak around"),
 * and arbitrary scroll-to-range with a highlighted band. Swapping in Monaco or
 * Code Hike later means replacing only this component.
 */

import { useEffect, useMemo, useRef } from 'react';
import hljs from 'highlight.js/lib/common';
import type { LineRange } from '../../../src/model/types';
import './highlight-monokai.css';
import './code-viewer.css';

export interface CodeViewerProps {
  /** Full file content — always the complete file, never an isolated snippet. */
  content: string;
  /** highlight.js language id, or undefined for auto-detection. */
  language?: string;
  /** Range to highlight and scroll into view (1-based, inclusive). */
  highlight?: LineRange | null;
  /** Path shown in the header. */
  path: string;
}

/** Map our language ids to highlight.js language names. */
function hljsLanguage(language?: string): string | undefined {
  switch (language) {
    case 'typescript':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'rust':
      return 'rust';
    case 'python':
      return 'python';
    default:
      return undefined;
  }
}

export function CodeViewer({
  content,
  language,
  highlight,
  path,
}: CodeViewerProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Highlight the whole file once per (content, language). Line-level
  // highlighting is done by splitting the highlighted HTML per line so line
  // numbers and the highlight band stay aligned.
  const lines = useMemo(() => {
    const lang = hljsLanguage(language);
    let html: string;
    try {
      html = lang
        ? hljs.highlight(content, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(content).value;
    } catch {
      html = escapeHtml(content);
    }
    return splitHighlightedLines(html);
  }, [content, language]);

  // Scroll the highlighted range into view whenever it changes.
  useEffect(() => {
    if (highlight && highlightRef.current && scrollRef.current) {
      highlightRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [highlight, path]);

  const start = highlight?.start ?? -1;
  const end = highlight?.end ?? -1;

  return (
    <div className="cv-root">
      <div className="cv-header">{path}</div>
      <div className="cv-scroll" ref={scrollRef}>
        <pre className="cv-code">
          <code>
            {lines.map((lineHtml, i) => {
              const lineNo = i + 1;
              const isHit = lineNo >= start && lineNo <= end;
              const isFirstHit = lineNo === start;
              return (
                <div
                  key={i}
                  className={`cv-line${isHit ? ' cv-line-hit' : ''}`}
                  ref={isFirstHit ? highlightRef : undefined}
                >
                  <span className="cv-gutter">{lineNo}</span>
                  <span
                    className="cv-content"
                    dangerouslySetInnerHTML={{ __html: lineHtml || '​' }}
                  />
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

/**
 * Split highlight.js output into per-line HTML, re-opening any `<span>` scopes
 * that span multiple lines (e.g. block comments) so each line is valid markup.
 */
function splitHighlightedLines(html: string): string[] {
  const rawLines = html.split('\n');
  const result: string[] = [];
  const openTags: string[] = [];

  const tagRe = /<span[^>]*>|<\/span>/g;

  for (const line of rawLines) {
    const prefix = openTags.join('');
    let match: RegExpExecArray | null;
    tagRe.lastIndex = 0;
    while ((match = tagRe.exec(line)) !== null) {
      if (match[0] === '</span>') openTags.pop();
      else openTags.push(match[0]);
    }
    const suffix = '</span>'.repeat(openTags.length);
    result.push(prefix + line + suffix);
  }

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
