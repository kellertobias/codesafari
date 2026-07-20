/**
 * Render authored Markdown: prose, inline code, links, images, `glossary:`
 * links (rewritten to in-app routes), file references (opened in the left code
 * surface), and fenced ```mermaid``` diagrams (rendered client-side with the
 * bundled Mermaid — no network).
 */

import { useEffect, useRef } from 'react';
import { marked } from 'marked';
import mermaid from 'mermaid';
import { useFileStore } from './fileStore';

let mermaidReady = false;
function ensureMermaid(): void {
  if (mermaidReady) return;
  mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
  mermaidReady = true;
}

// Deterministic-ish ids without Math.random to keep renders stable per content.
let diagramSeq = 0;

interface MarkdownProps {
  source: string;
}

/** True for links that point outside the project (open normally). */
function isExternal(href: string): boolean {
  return /^[a-z]+:\/\//i.test(href) || href.startsWith('mailto:');
}

/** Convert Markdown to HTML, extracting mermaid blocks for async rendering. */
function renderMarkdown(source: string): string {
  const renderer = new marked.Renderer();

  renderer.link = function link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';

    // Glossary concept → in-app route.
    if (href.startsWith('glossary:')) {
      const slug = href.slice('glossary:'.length);
      return `<a href="#/glossary#${escapeAttr(slug)}"${titleAttr}>${text}</a>`;
    }

    // External or in-app hash links → normal anchors.
    if (isExternal(href)) {
      return `<a href="${escapeAttr(href)}"${titleAttr} target="_blank" rel="noreferrer">${text}</a>`;
    }
    if (href.startsWith('#')) {
      return `<a href="${escapeAttr(href)}"${titleAttr}>${text}</a>`;
    }

    // Anything else is a project-relative file reference, optionally with a
    // `:line` suffix. It opens in the left code surface (handled on click).
    const match = /^(.*?)(?::(\d+))?$/.exec(href) ?? [href, href];
    const path = (match[1] ?? href).replace(/^\.\//, '');
    const line = match[2];
    const lineAttr = line ? ` data-line="${line}"` : '';
    return `<a href="#" class="file-link" data-file="${escapeAttr(path)}"${lineAttr}${titleAttr}>${text}</a>`;
  };

  // Emit mermaid fences as placeholders we hydrate after mount.
  renderer.code = ({ text, lang }) => {
    if (lang === 'mermaid') {
      const encoded = encodeURIComponent(text);
      return `<div class="mermaid-block" data-src="${encoded}"></div>`;
    }
    return `<pre><code>${escapeHtml(text)}</code></pre>`;
  };

  return marked.parse(source, { renderer, async: false }) as string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

export function Markdown({ source }: MarkdownProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const { openFile } = useFileStore();
  const html = renderMarkdown(source);

  // Render any Mermaid diagrams after the HTML mounts.
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const blocks = container.querySelectorAll<HTMLElement>('.mermaid-block');
    if (blocks.length === 0) return;
    ensureMermaid();

    blocks.forEach((block) => {
      const src = decodeURIComponent(block.dataset.src ?? '');
      const id = `mermaid-${diagramSeq++}`;
      mermaid
        .render(id, src)
        .then(({ svg }) => {
          block.innerHTML = svg;
        })
        .catch((err: unknown) => {
          block.innerHTML = `<div class="mermaid-error">Diagram error: ${escapeHtml(
            String(err),
          )}</div>`;
        });
    });
  }, [html]);

  // Intercept file-reference clicks and open them in the left code surface.
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.file-link');
    if (!anchor) return;
    e.preventDefault();
    const path = anchor.dataset.file;
    if (!path) return;
    const line = anchor.dataset.line ? Number(anchor.dataset.line) : undefined;
    openFile(path, line);
  };

  return (
    <div
      className="md"
      ref={ref}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
