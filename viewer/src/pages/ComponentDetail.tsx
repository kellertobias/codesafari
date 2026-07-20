/** Component detail: description plus all tours assigned to the component. */

import type { Manifest } from '../../../src/model/types';
import { Markdown } from '../Markdown';
import { href, navigate } from '../router';

export function ComponentDetail({
  manifest,
  slug,
}: {
  manifest: Manifest;
  slug: string;
}): JSX.Element {
  const component = manifest.components.find((c) => c.slug === slug);
  if (!component) {
    return (
      <div className="page">
        <p className="empty">Unknown component: {slug}</p>
        <a href={href('/')}>Back to overview</a>
      </div>
    );
  }

  const tours = manifest.tours.filter((t) => t.components.includes(slug));

  return (
    <div className="page">
      <p>
        <a href={href('/')}>← Overview</a>
      </p>
      <h1>{component.title}</h1>
      {component.summary && <p className="empty">{component.summary}</p>}
      <Markdown source={component.body} />

      <h2 className="section-title">Tours</h2>
      {tours.length === 0 ? (
        <p className="empty">No tours are assigned to this component.</p>
      ) : (
        <div className="card-grid">
          {tours.map((tour) => (
            <button
              key={tour.slug}
              className="card"
              onClick={() => navigate(`/tour/${tour.slug}`)}
            >
              <div className="card-title">{tour.title}</div>
              <div className="card-summary">{tour.steps.length} steps</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
