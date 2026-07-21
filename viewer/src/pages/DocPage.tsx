/**
 * A standalone documentation page from `.tour/docs`.
 *
 * Docs are long-form prose, so the page itself is deliberately plain: a
 * breadcrumb back up the folder structure, the title, the body, and — for a
 * section page — links to the pages nested beneath it. Navigation between docs
 * lives in the sidebar tree, not here.
 */

import { useMemo } from 'react';
import type { Doc, Manifest } from '../../../src/model/types';
import { Markdown } from '../Markdown';
import { href, navigate } from '../router';
import { buildDocTree, ROOT_DOC_SLUG, type DocNode } from '../docs/navTree';

export function DocPage({
  manifest,
  slug,
}: {
  manifest: Manifest;
  slug: string;
}): JSX.Element {
  const docs = manifest.docs;
  const nodes = useMemo(() => buildDocTree(docs), [docs]);

  // `#/doc` with no slug lands on the docs root page when one is authored, and
  // on a generated index of the top-level entries otherwise.
  const effectiveSlug = slug || ROOT_DOC_SLUG;
  const doc = docs.find((d) => d.slug === effectiveSlug);

  if (!doc) {
    if (!slug) return <DocsIndex nodes={nodes} />;
    return (
      <div className="page">
        <p className="empty">Unknown documentation page: {slug}</p>
        <a href={href('/')}>Back to overview</a>
      </div>
    );
  }

  const children = findNode(nodes, doc.slug)?.children ?? [];

  return (
    <div className="page">
      <Breadcrumb docs={docs} nodes={nodes} slug={doc.slug} />
      <h1>{doc.title}</h1>
      <Markdown source={doc.body} />
      {children.length > 0 && <ChildCards title="In this section" nodes={children} />}
    </div>
  );
}

/** The generated landing page for `#/doc` when no root `index.md` is authored. */
function DocsIndex({ nodes }: { nodes: DocNode[] }): JSX.Element {
  return (
    <div className="page">
      <p>
        <a href={href('/')}>← Overview</a>
      </p>
      <h1>Documentation</h1>
      {nodes.length === 0 ? (
        <p className="empty">
          No documentation pages yet. Add Markdown files under{' '}
          <code>.tour/docs/</code>.
        </p>
      ) : (
        <ChildCards nodes={nodes} />
      )}
    </div>
  );
}

/** Card links to a set of sibling doc nodes. */
function ChildCards({
  nodes,
  title,
}: {
  nodes: DocNode[];
  title?: string;
}): JSX.Element {
  return (
    <>
      {title && <h2 className="section-title">{title}</h2>}
      <div className="card-grid">
        {nodes.map((node) => (
          <button
            key={node.path}
            className="card"
            // A bare folder has no page of its own, so open its first child.
            onClick={() => navigate(`/doc/${node.doc?.slug ?? firstSlug(node)}`)}
          >
            <div className="card-title">{node.label}</div>
            {node.children.length > 0 && (
              <div className="card-summary">
                {node.children.length} page
                {node.children.length === 1 ? '' : 's'}
              </div>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

/** Links back up through the ancestor sections of a doc. */
function Breadcrumb({
  docs,
  nodes,
  slug,
}: {
  docs: Doc[];
  nodes: DocNode[];
  slug: string;
}): JSX.Element {
  const parts = slug.split('/');
  const crumbs: Array<{ label: string; slug: string | null }> = [];
  let prefix = '';
  for (let i = 0; i < parts.length - 1; i++) {
    prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
    const node = findNode(nodes, prefix);
    // A bare folder isn't linkable; it still shows as a crumb for orientation.
    crumbs.push({ label: node?.label ?? parts[i], slug: node?.doc?.slug ?? null });
  }

  const rootDoc = docs.find((d) => d.slug === ROOT_DOC_SLUG);

  return (
    <p className="doc-breadcrumb">
      <a href={href('/doc')}>{rootDoc?.title ?? 'Documentation'}</a>
      {crumbs.map((crumb) => (
        <span key={crumb.label}>
          {' / '}
          {crumb.slug ? (
            <a href={href(`/doc/${crumb.slug}`)}>{crumb.label}</a>
          ) : (
            <span className="empty">{crumb.label}</span>
          )}
        </span>
      ))}
    </p>
  );
}

/** Depth-first lookup of the node at a slug path. */
function findNode(nodes: DocNode[], path: string): DocNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (path.startsWith(`${node.path}/`)) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

/** The slug of the first page at or beneath a node. */
function firstSlug(node: DocNode): string {
  if (node.doc) return node.doc.slug;
  for (const child of node.children) {
    const slug = firstSlug(child);
    if (slug) return slug;
  }
  return ROOT_DOC_SLUG;
}
