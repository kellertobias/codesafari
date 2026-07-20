/** Glossary page: lists every concept with an anchor per concept. */

import { useEffect } from 'react';
import type { Manifest } from '../../../src/model/types';
import { Markdown } from '../Markdown';
import { href, useRoute } from '../router';

export function Glossary({ manifest }: { manifest: Manifest }): JSX.Element {
  const route = useRoute();

  // Scroll to the anchored concept when arriving via a glossary: link.
  useEffect(() => {
    if (route.anchor) {
      const el = document.getElementById(route.anchor);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [route.anchor]);

  return (
    <div className="page">
      <p>
        <a href={href('/')}>← Overview</a>
      </p>
      <h1>Glossary</h1>
      {manifest.glossary.length === 0 && (
        <p className="empty">No glossary concepts defined.</p>
      )}
      {manifest.glossary.map((concept) => (
        <section key={concept.slug} id={concept.slug} style={{ marginBottom: 24 }}>
          <h2 className="section-title">{concept.title}</h2>
          <Markdown source={concept.body} />
        </section>
      ))}
    </div>
  );
}
