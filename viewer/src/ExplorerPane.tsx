/**
 * The left code surface: an activity bar with a folder button that toggles the
 * file tree, the tree itself, and the read-only code viewer for the open file.
 *
 * When no file is open the surface collapses to just the activity bar, giving
 * the right-hand content full width. Opening a file (from the tree, a tour
 * step, or a Markdown reference) only affects this pane.
 */

import { useMemo } from 'react';
import type { SourceFile } from '../../src/model/types';
import { useFileStore } from './fileStore';
import { FileTree } from './FileTree';
import { CodeViewer } from './code/CodeViewer';
import { ExplorerIcon } from './tree/icons';

export function ExplorerPane(): JSX.Element {
  const {
    files,
    openPath,
    highlight,
    treeOpen,
    openFile,
    closeFile,
    toggleTree,
  } = useFileStore();

  const fileByPath = useMemo(() => {
    const map = new Map<string, SourceFile>();
    for (const file of files) map.set(file.path, file);
    return map;
  }, [files]);

  const activeFile = openPath ? fileByPath.get(openPath) : undefined;

  return (
    <div className={`explorer${openPath ? ' has-file' : ''}`}>
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
        <div className="pane tree">
          <div className="pane-header">Explorer</div>
          <FileTree
            files={files}
            activePath={openPath}
            onSelect={(path) => openFile(path)}
          />
        </div>
      )}

      {openPath && (
        <div className="pane code">
          {activeFile ? (
            <CodeViewer
              content={activeFile.content}
              language={activeFile.language}
              highlight={highlight}
              path={activeFile.path}
              onClose={closeFile}
            />
          ) : (
            <div className="empty" style={{ padding: 16 }}>
              Source not bundled: {openPath}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
