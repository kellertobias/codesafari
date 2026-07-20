/** A grouped file tree for the tour runner's left pane. */

import { useMemo } from 'react';
import type { SourceFile } from '../../src/model/types';

interface FileTreeProps {
  files: SourceFile[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

interface DirGroup {
  dir: string;
  files: { path: string; name: string }[];
}

/** Group files by their parent directory for a compact, readable tree. */
function groupByDir(files: SourceFile[]): DirGroup[] {
  const groups = new Map<string, { path: string; name: string }[]>();
  for (const file of files) {
    const slash = file.path.lastIndexOf('/');
    const dir = slash === -1 ? '.' : file.path.slice(0, slash);
    const name = slash === -1 ? file.path : file.path.slice(slash + 1);
    const list = groups.get(dir) ?? [];
    list.push({ path: file.path, name });
    groups.set(dir, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, list]) => ({
      dir,
      files: list.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function FileTree({
  files,
  activePath,
  onSelect,
}: FileTreeProps): JSX.Element {
  const groups = useMemo(() => groupByDir(files), [files]);

  if (files.length === 0) {
    return <div className="empty" style={{ padding: '10px 14px' }}>No files</div>;
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.dir}>
          <div className="tree-dir">{group.dir === '.' ? '(root)' : group.dir}</div>
          {group.files.map((file) => (
            <button
              key={file.path}
              className={`tree-item${file.path === activePath ? ' active' : ''}`}
              onClick={() => onSelect(file.path)}
              title={file.path}
            >
              {file.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
