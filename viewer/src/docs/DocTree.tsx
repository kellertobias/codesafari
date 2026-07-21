/**
 * The documentation navigation tree, shown in the sidebar under the Docs icon.
 *
 * It mirrors the file tree's visual language (chevrons, indent guides, badges)
 * but navigates the right-hand region instead of opening source files. A folder
 * that has its own page is clickable as well as expandable: the chevron toggles
 * its children, the label opens the page.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Doc } from '../../../src/model/types';
import { ChevronIcon } from '../tree/icons';
import { DocPageIcon, DocSectionIcon } from './icons';
import { href } from '../router';
import { buildDocTree, docAncestors, type DocNode } from './navTree';

interface DocTreeProps {
  docs: Doc[];
  /** Slug of the doc currently open in the right-hand region, if any. */
  activeSlug: string | null;
}

export function DocTree({ docs, activeSlug }: DocTreeProps): JSX.Element {
  const nodes = useMemo(() => buildDocTree(docs), [docs]);

  // Collapsed by default; only the active page's ancestors start expanded.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(docAncestors(activeSlug)),
  );

  // Re-expand toward the active page whenever it changes.
  useEffect(() => {
    const ancestors = docAncestors(activeSlug);
    if (ancestors.length === 0) return;
    setExpanded((prev) => {
      if (ancestors.every((a) => prev.has(a))) return prev;
      const next = new Set(prev);
      for (const a of ancestors) next.add(a);
      return next;
    });
  }, [activeSlug]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (nodes.length === 0) {
    return (
      <div className="empty" style={{ padding: '10px 14px' }}>
        No documentation pages
      </div>
    );
  }

  const guides = (depth: number) =>
    depth === 0 ? null : (
      <span className="indent-guides" aria-hidden>
        {Array.from({ length: depth }, (_, i) => (
          <span key={i} className="indent-guide" />
        ))}
      </span>
    );

  const renderNodes = (list: DocNode[], depth: number): JSX.Element[] =>
    list.flatMap((node) => {
      const open = expanded.has(node.path);
      const hasChildren = node.children.length > 0;
      const active = node.doc?.slug === activeSlug;

      // A node without a page can only expand, so the whole row is the toggle.
      const row = node.doc ? (
        <a
          key={node.path}
          className={`tree-row tree-doc-row${active ? ' active' : ''}`}
          href={href(`/doc/${node.doc.slug}`)}
          title={node.doc.title}
        >
          {guides(depth)}
          {hasChildren ? (
            <span
              className="tree-chevron-hit"
              role="button"
              tabIndex={-1}
              aria-label={open ? 'Collapse section' : 'Expand section'}
              onClick={(e) => {
                // Toggling the section must not also navigate to its page.
                e.preventDefault();
                e.stopPropagation();
                toggle(node.path);
              }}
            >
              <ChevronIcon open={open} />
            </span>
          ) : (
            <span className="tree-chevron" aria-hidden />
          )}
          {hasChildren ? <DocSectionIcon open={open} /> : <DocPageIcon />}
          <span className="tree-label">{node.label}</span>
        </a>
      ) : (
        <button
          key={node.path}
          className="tree-row tree-dir-row"
          onClick={() => toggle(node.path)}
          title={node.path}
        >
          {guides(depth)}
          <ChevronIcon open={open} />
          <DocSectionIcon open={open} />
          <span className="tree-label">{node.label}</span>
        </button>
      );

      return [
        row,
        ...(hasChildren && open ? renderNodes(node.children, depth + 1) : []),
      ];
    });

  return <div className="tree">{renderNodes(nodes, 0)}</div>;
}
