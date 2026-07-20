/** Landing page: project intro, components, tours, and a glossary link. */

import type { Manifest } from '../../../src/model/types';
import { Markdown } from '../Markdown';
import { href } from '../router';

export function Landing({ manifest }: { manifest: Manifest }): JSX.Element {
  const { project, components, tours, glossary } = manifest;
  return (
    <div className="page">
      <h1>{project.title}</h1>
      {project.description && <p className="empty">{project.description}</p>}
      <Markdown source={project.body} />

      <h2 className="section-title">Tours</h2>
      {tours.length === 0 ? (
        <p className="empty">No tours defined yet.</p>
      ) : (
        <div className="card-grid">
          {tours.map((tour) => (
            <a key={tour.slug} className="card" href={href(`/tour/${tour.slug}`)}>
              <div className="card-title">{tour.title}</div>
              <div className="card-summary">
                {tour.steps.length} step{tour.steps.length === 1 ? '' : 's'}
              </div>
            </a>
          ))}
        </div>
      )}

      <h2 className="section-title">Components</h2>
      {components.length === 0 ? (
        <p className="empty">No components defined yet.</p>
      ) : (
        <div className="card-grid">
          {components.map((component) => (
            <a
              key={component.slug}
              className="card"
              href={href(`/component/${component.slug}`)}
            >
              <div className="card-title">{component.title}</div>
              {component.summary && (
                <div className="card-summary">{component.summary}</div>
              )}
            </a>
          ))}
        </div>
      )}

      {glossary.length > 0 && (
        <>
          <h2 className="section-title">Glossary</h2>
          <p>
            <a className="btn secondary" href={href('/glossary')}>
              Browse {glossary.length} concept{glossary.length === 1 ? '' : 's'}
            </a>
          </p>
        </>
      )}
    </div>
  );
}
