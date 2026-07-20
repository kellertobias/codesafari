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
import { useGlossary } from './glossaryStore';

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

    // Glossary concept → open the glossary side-panel (handled on click).
    if (href.startsWith('glossary:')) {
      const slug = href.slice('glossary:'.length);
      return `<a href="#" class="glossary-link" data-glossary="${escapeAttr(slug)}"${titleAttr}>${text}</a>`;
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

  // Obsidian-style callouts: a blockquote whose first line is `> [!TYPE] Title`
  // renders as a titled callout box instead of a plain quote. The marker is a
  // Markdown-body feature, independent of how a step was authored in source.
  renderer.blockquote = function blockquote({ text, tokens }) {
    const firstLine = text.trimStart().split('\n', 1)[0];
    const marker = /^\[!(\w+)\]([+-]?)\s*(.*)$/.exec(firstLine);
    if (marker) {
      const type = marker[1].toLowerCase();
      const title = marker[3].trim() || capitalize(type);
      // Re-parse everything after the marker line as the callout body.
      const body = text.replace(/^[^\n]*(\n|$)/, '');
      const bodyHtml = marked.parse(body, { renderer, async: false }) as string;
      return (
        `<div class="callout callout-${escapeAttr(type)}">` +
        `<div class="callout-title">${escapeHtml(title)}</div>` +
        `<div class="callout-body">${bodyHtml}</div>` +
        `</div>`
      );
    }
    return `<blockquote>${this.parser.parse(tokens)}</blockquote>`;
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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  const { openGlossary } = useGlossary();
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

  // Intercept in-app links: file references open on the left code surface,
  // glossary links open the glossary side-panel. Everything else is a normal
  // anchor handled by the browser.
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    const glossaryLink = target.closest<HTMLAnchorElement>('a.glossary-link');
    if (glossaryLink) {
      e.preventDefault();
      openGlossary(glossaryLink.dataset.glossary);
      return;
    }

    const fileLink = target.closest<HTMLAnchorElement>('a.file-link');
    if (fileLink?.dataset.file) {
      e.preventDefault();
      const line = fileLink.dataset.line ? Number(fileLink.dataset.line) : undefined;
      openFile(fileLink.dataset.file, line);
    }
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
