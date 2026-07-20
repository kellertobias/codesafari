/** Tour entry page: Markdown intro + a "Start tour" action. */

import type { Manifest } from '../../../src/model/types';
import { Markdown } from '../Markdown';
import { href, navigate } from '../router';

export function TourIntro({
  manifest,
  slug,
}: {
  manifest: Manifest;
  slug: string;
}): JSX.Element {
  const tour = manifest.tours.find((t) => t.slug === slug);
  if (!tour) {
    return (
      <div className="page">
        <p className="empty">Unknown tour: {slug}</p>
        <a href={href('/')}>Back to overview</a>
      </div>
    );
  }

  const components = manifest.components.filter((c) =>
    tour.components.includes(c.slug),
  );

  return (
    <div className="page">
      <p>
        <a href={href('/')}>← Overview</a>
      </p>
      <h1>{tour.title}</h1>
      <Markdown source={tour.body} />

      {components.length > 0 && (
        <p className="empty">
          Related components:{' '}
          {components.map((c, i) => (
            <span key={c.slug}>
              {i > 0 && ', '}
              <a href={href(`/component/${c.slug}`)}>{c.title}</a>
            </span>
          ))}
        </p>
      )}

      <p style={{ marginTop: 24 }}>
        <button
          className="btn"
          disabled={tour.steps.length === 0}
          onClick={() => navigate(`/tour/${tour.slug}/run`)}
        >
          {tour.steps.length === 0 ? 'No steps yet' : 'Start tour'}
        </button>
      </p>
    </div>
  );
}
