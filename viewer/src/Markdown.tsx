/**
 * Render authored Markdown: prose, inline code, links, images, `glossary:`
 * links (rewritten to in-app routes), and fenced ```mermaid``` diagrams
 * (rendered client-side with the bundled Mermaid — no network).
 */

import { useEffect, useRef } from 'react';
import { marked } from 'marked';
import mermaid from 'mermaid';

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

/** Convert Markdown to HTML, extracting mermaid blocks for async rendering. */
function renderMarkdown(source: string): string {
  const renderer = new marked.Renderer();

  // Rewrite `glossary:<slug>` links to hash routes.
  const baseLink = renderer.link.bind(renderer);
  renderer.link = ({ href, title, tokens }) => {
    if (href.startsWith('glossary:')) {
      const slug = href.slice('glossary:'.length);
      return baseLink({
        href: `#/glossary#${slug}`,
        title: title ?? null,
        tokens,
      } as Parameters<typeof baseLink>[0]);
    }
    return baseLink({ href, title: title ?? null, tokens } as Parameters<
      typeof baseLink
    >[0]);
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

export function Markdown({ source }: MarkdownProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const html = renderMarkdown(source);

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

  return (
    <div className="md" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
