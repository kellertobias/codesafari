/**
 * Turn the flat list of docs into the nested navigation tree the sidebar shows.
 *
 * Every folder under `.tour/docs` is a structure node. A folder that ships its
 * own `index.md` produces a node that is both clickable (it has a page) and
 * expandable (it has children); a folder without one is a pure grouping node
 * whose label is derived from the folder name.
 */

import type { Doc } from '../../../src/model/types';

export interface DocNode {
  /** Slug path of this node, e.g. `architecture/event-loop`. Unique per node. */
  path: string;
  /** The doc rendered when this node is clicked, or null for a bare folder. */
  doc: Doc | null;
  /** Label shown in the tree. */
  label: string;
  children: DocNode[];
}

/**
 * The docs root page (`.tour/docs/index.md`). It is the landing page for the
 * docs section rather than an entry inside the tree, so it is excluded from
 * {@link buildDocTree}.
 */
export const ROOT_DOC_SLUG = 'index';

/** Turn a `kebab-case` slug segment into a readable folder label. */
function humanize(segment: string): string {
  const words = segment.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Build the nested navigation tree, sorted by `order` then label. */
export function buildDocTree(docs: Doc[]): DocNode[] {
  const root: DocNode = { path: '', doc: null, label: '', children: [] };

  for (const doc of docs) {
    if (doc.slug === ROOT_DOC_SLUG) continue;

    let node = root;
    let prefix = '';
    for (const part of doc.slug.split('/')) {
      prefix = prefix ? `${prefix}/${part}` : part;
      let child = node.children.find((c) => c.path === prefix);
      if (!child) {
        child = { path: prefix, doc: null, label: humanize(part), children: [] };
        node.children.push(child);
      }
      node = child;
    }
    // The last segment is the doc itself — an intermediate node created earlier
    // by a nested sibling gets its page (and real title) attached here.
    node.doc = doc;
    node.label = doc.navTitle ?? doc.title;
  }

  sortNodes(root);
  return root.children;
}

/**
 * Sort siblings by explicit `order`, then alphabetically. Folders and pages are
 * interleaved rather than grouped: in prose navigation the reading order an
 * author picks matters more than whether an entry happens to have children.
 */
function sortNodes(node: DocNode): void {
  node.children.sort((a, b) => {
    const ao = a.doc?.order ?? Number.POSITIVE_INFINITY;
    const bo = b.doc?.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.label.localeCompare(b.label);
  });
  for (const child of node.children) sortNodes(child);
}

/** Every ancestor node path of a slug, for auto-expanding the active page. */
export function docAncestors(slug: string | null): string[] {
  if (!slug) return [];
  const parts = slug.split('/');
  const out: string[] = [];
  let prefix = '';
  for (let i = 0; i < parts.length - 1; i++) {
    prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
    out.push(prefix);
  }
  return out;
}
