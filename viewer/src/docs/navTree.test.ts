import { describe, expect, it } from 'vitest';
import type { Doc } from '../../../src/model/types';
import { buildDocTree, docAncestors } from './navTree';

const doc = (slug: string, extra: Partial<Doc> = {}): Doc => ({
  slug,
  title: slug,
  body: '',
  sourcePath: `.tour/docs/${slug}.md`,
  ...extra,
});

describe('buildDocTree', () => {
  it('nests pages under the folders in their slug', () => {
    const tree = buildDocTree([
      doc('architecture/event-loop'),
      doc('deployment'),
    ]);

    expect(tree.map((n) => n.path)).toEqual(['architecture', 'deployment']);
    expect(tree[0].children.map((n) => n.path)).toEqual([
      'architecture/event-loop',
    ]);
  });

  it('gives a folder its own page when an index doc claims the slug', () => {
    const tree = buildDocTree([
      doc('architecture', { title: 'How it fits together' }),
      doc('architecture/event-loop'),
    ]);

    // One node: clickable (it has a page) and expandable (it has children).
    expect(tree).toHaveLength(1);
    expect(tree[0].doc?.slug).toBe('architecture');
    expect(tree[0].label).toBe('How it fits together');
    expect(tree[0].children).toHaveLength(1);
  });

  it('leaves a folder with no index doc as a bare structure node', () => {
    const tree = buildDocTree([doc('architecture/internals/scheduler')]);

    const internals = tree[0].children[0];
    expect(internals.path).toBe('architecture/internals');
    expect(internals.doc).toBeNull();
    // No page, so the label is humanized from the folder name.
    expect(internals.label).toBe('Internals');
  });

  it('prefers navTitle over title for the tree label', () => {
    const tree = buildDocTree([
      doc('architecture', { title: 'How it fits together', navTitle: 'Arch' }),
    ]);
    expect(tree[0].label).toBe('Arch');
  });

  it('sorts by order, then label, with unordered entries last', () => {
    const tree = buildDocTree([
      doc('zebra', { title: 'Zebra', order: 1 }),
      doc('alpha', { title: 'Alpha' }),
      doc('beta', { title: 'Beta', order: 2 }),
    ]);
    expect(tree.map((n) => n.label)).toEqual(['Zebra', 'Beta', 'Alpha']);
  });

  it('excludes the docs root page from the tree', () => {
    const tree = buildDocTree([doc('index'), doc('deployment')]);
    expect(tree.map((n) => n.path)).toEqual(['deployment']);
  });
});

describe('docAncestors', () => {
  it('lists every parent folder path of a slug', () => {
    expect(docAncestors('a/b/c')).toEqual(['a', 'a/b']);
    expect(docAncestors('a')).toEqual([]);
    expect(docAncestors(null)).toEqual([]);
  });
});
