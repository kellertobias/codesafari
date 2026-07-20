/**
 * The glossary drawer — a third pane on the right of the shell. It lists every
 * concept with a title search and, when opened via a `glossary:` link, scrolls
 * to the linked concept. It floats alongside whatever page or tour is open, so
 * looking a term up never disturbs the current tour or open file.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GlossaryConcept } from '../../src/model/types';
import { Markdown } from './Markdown';
import { useGlossary } from './glossaryStore';
import { CloseIcon } from './tree/icons';

export function GlossaryPanel({
  concepts,
}: {
  concepts: GlossaryConcept[];
}): JSX.Element | null {
  const { open, focus, closeGlossary } = useGlossary();
  const [query, setQuery] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  // When opened targeting a concept, clear any active filter (so the concept is
  // visible) and scroll it into view once rendered.
  useEffect(() => {
    if (!open || !focus.slug) return;
    setQuery('');
    const raf = requestAnimationFrame(() => {
      bodyRef.current
        ?.querySelector(`[data-slug="${focus.slug}"]`)
        ?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, focus.seq, focus.slug]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? concepts.filter((c) => c.title.toLowerCase().includes(q)) : concepts;
  }, [concepts, query]);

  if (!open) return null;

  return (
    <aside className="glossary-panel">
      <div className="glossary-head">
        <span className="glossary-title">Glossary</span>
        <button
          className="glossary-close"
          onClick={closeGlossary}
          title="Close glossary"
          aria-label="Close glossary"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="glossary-search">
        <input
          type="search"
          placeholder="Search concepts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="glossary-body" ref={bodyRef}>
        {filtered.length === 0 ? (
          <p className="empty">No matching concepts.</p>
        ) : (
          filtered.map((concept) => (
            <section
              key={concept.slug}
              data-slug={concept.slug}
              className="glossary-concept"
            >
              <h3>{concept.title}</h3>
              <Markdown source={concept.body} />
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
