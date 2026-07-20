/**
 * The left code surface: an activity bar with a folder button that toggles the
 * file tree, the (resizable) tree, and a tabbed read-only code viewer.
 *
 * When no file is open the surface collapses to just the activity bar, giving
 * the right-hand content full width.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { SourceFile } from '../../src/model/types';
import { useFileStore } from './fileStore';
import { FileTree } from './FileTree';
import { CodeViewer } from './code/CodeViewer';
import { Tabs } from './code/Tabs';
import { ExplorerIcon } from './tree/icons';

const MIN_TREE = 160;
const MAX_TREE = 520;

export function ExplorerPane(): JSX.Element {
  const {
    files,
    tabs,
    activePath,
    highlight,
    context,
    highlightPath,
    treeOpen,
    openFile,
    toggleTree,
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
          className={`activity-btn${treeOpen ? ' active' : ''}`}
          onClick={toggleTree}
          title="Toggle file tree"
          aria-label="Toggle file tree"
          aria-pressed={treeOpen}
        >
          <ExplorerIcon />
        </button>
      </div>

      {treeOpen && (
        <>
          <div className="pane tree" style={{ width: treeWidth, flexBasis: treeWidth }}>
            <div className="pane-header">Explorer</div>
            <FileTree
              files={files}
              activePath={activePath}
              onSelect={(path) => openFile(path)}
            />
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
