/**
 * The left surface: an activity bar, one (resizable) navigation pane, and a
 * tabbed read-only code viewer.
 *
 * The activity bar selects which navigation pane is showing — the repository's
 * source files, or the authored documentation tree from `.tour/docs`. Clicking
 * the active button collapses the pane again.
 *
 * When no file is open and no pane is showing, the surface collapses to just
 * the activity bar, giving the right-hand content full width.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Doc, SourceFile } from '../../src/model/types';
import { useFileStore } from './fileStore';
import { FileTree } from './FileTree';
import { CodeViewer } from './code/CodeViewer';
import { Tabs } from './code/Tabs';
import { ExplorerIcon } from './tree/icons';
import { DocTree } from './docs/DocTree';
import { DocsIcon } from './docs/icons';

const MIN_TREE = 160;
const MAX_TREE = 520;

interface ExplorerPaneProps {
  docs: Doc[];
  /** Slug of the doc currently open on the right, so the tree can mark it. */
  activeDocSlug: string | null;
}

export function ExplorerPane({
  docs,
  activeDocSlug,
}: ExplorerPaneProps): JSX.Element {
  const {
    files,
    tabs,
    activePath,
    highlight,
    context,
    highlightPath,
    panel,
    openFile,
    togglePanel,
  } = useFileStore();

  const [treeWidth, setTreeWidth] = useState(240);
  const dragging = useRef(false);

  const fileByPath = useMemo(() => {
    const map = new Map<string, SourceFile>();
    for (const file of files) map.set(file.path, file);
    return map;
  }, [files]);

  const activeFile = activePath ? fileByPath.get(activePath) : undefined;
  // A highlight/context only applies to the file it was opened for.
  const onActiveFile = activePath === highlightPath;
  const activeHighlight = onActiveFile ? highlight : null;
  const activeContext = onActiveFile ? context : null;

  // Drag-to-resize the tree pane.
  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startWidth = treeWidthRef.current;
    // Suppress text selection and show the resize cursor for the whole drag.
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return;
      const next = Math.min(MAX_TREE, Math.max(MIN_TREE, startWidth + (ev.clientX - startX)));
      setTreeWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  // Keep a ref of the latest width for the drag closure.
  const treeWidthRef = useRef(treeWidth);
  treeWidthRef.current = treeWidth;

  return (
    <div className="explorer">
      <div className="activity-bar">
        <button
          className={`activity-btn${panel === 'files' ? ' active' : ''}`}
          onClick={() => togglePanel('files')}
          title="Toggle file tree"
          aria-label="Toggle file tree"
          aria-pressed={panel === 'files'}
        >
          <ExplorerIcon />
        </button>
        {docs.length > 0 && (
          <button
            className={`activity-btn${panel === 'docs' ? ' active' : ''}`}
            onClick={() => togglePanel('docs')}
            title="Toggle documentation"
            aria-label="Toggle documentation"
            aria-pressed={panel === 'docs'}
          >
            <DocsIcon />
          </button>
        )}
      </div>

      {panel !== null && (
        <>
          <div className="pane tree" style={{ width: treeWidth, flexBasis: treeWidth }}>
            <div className="pane-header">
              {panel === 'docs' ? 'Documentation' : 'Explorer'}
            </div>
            {panel === 'docs' ? (
              <DocTree docs={docs} activeSlug={activeDocSlug} />
            ) : (
              <FileTree
                files={files}
                activePath={activePath}
                onSelect={(path) => openFile(path)}
              />
            )}
          </div>
          <div
            className="resize-handle"
            onPointerDown={onDragStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize file tree"
          />
        </>
      )}

      {tabs.length > 0 && (
        <div className="pane code">
          <Tabs />
          {activeFile ? (
            <CodeViewer
              content={activeFile.content}
              language={activeFile.language}
              highlight={activeHighlight}
              context={activeContext}
              path={activeFile.path}
            />
          ) : (
            <div className="empty" style={{ padding: 16 }}>
              {activePath ? `Source not bundled: ${activePath}` : 'No file open.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
