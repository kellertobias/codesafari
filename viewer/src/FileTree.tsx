/**
 * A VS Code-like file tree: real nested directories with disclosure chevrons,
 * amber folder glyphs, and colored per-extension file badges. Directories are
 * collapsible; the ancestors of the active file are always kept expanded.
 */

import { useEffect, useMemo, useState } from 'react';
import type { SourceFile } from '../../src/model/types';
import { ChevronIcon, FileIcon, FolderIcon } from './tree/icons';

interface TreeNode {
  name: string;
  /** Full path for files; directory path for dirs. */
  path: string;
  type: 'file' | 'dir';
  children: TreeNode[];
}

interface FileTreeProps {
  files: SourceFile[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

/** Build a nested tree from flat file paths. */
function buildTree(files: SourceFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', type: 'dir', children: [] };

  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    let prefix = '';
    parts.forEach((part, i) => {
      prefix = prefix ? `${prefix}/${part}` : part;
      const isLeaf = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: prefix,
          type: isLeaf ? 'file' : 'dir',
          children: [],
        };
        node.children.push(child);
      }
      node = child;
    });
  }

  sortTree(root);
  return root;
}

/** Directories first, then files; each group alphabetical. */
function sortTree(node: TreeNode): void {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) sortTree(child);
}

/** Every ancestor directory path of a file path. */
function ancestorsOf(filePath: string): string[] {
  const parts = filePath.split('/');
  const out: string[] = [];
  let prefix = '';
  for (let i = 0; i < parts.length - 1; i++) {
    prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
    out.push(prefix);
  }
  return out;
}

export function FileTree({
  files,
  activePath,
  onSelect,
}: FileTreeProps): JSX.Element {
  const root = useMemo(() => buildTree(files), [files]);

  // Directories are expanded by default; the set tracks collapsed ones.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Keep the active file's ancestors expanded when the step changes files.
  useEffect(() => {
    if (!activePath) return;
    const ancestors = ancestorsOf(activePath);
    setCollapsed((prev) => {
      if (!ancestors.some((a) => prev.has(a))) return prev;
      const next = new Set(prev);
      for (const a of ancestors) next.delete(a);
      return next;
    });
  }, [activePath]);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (files.length === 0) {
    return (
      <div className="empty" style={{ padding: '10px 14px' }}>
        No files
      </div>
    );
  }

  const renderNodes = (nodes: TreeNode[], depth: number): JSX.Element[] =>
    nodes.flatMap((node) => {
      const indent = 6 + depth * 12;
      if (node.type === 'dir') {
        const open = !collapsed.has(node.path);
        return [
          <button
            key={node.path}
            className="tree-row tree-dir-row"
            style={{ paddingLeft: indent }}
            onClick={() => toggle(node.path)}
            title={node.path}
          >
            <ChevronIcon open={open} />
            <FolderIcon open={open} />
            <span className="tree-label">{node.name}</span>
          </button>,
          ...(open ? renderNodes(node.children, depth + 1) : []),
        ];
      }
      return [
        <button
          key={node.path}
          className={`tree-row tree-file-row${node.path === activePath ? ' active' : ''}`}
          style={{ paddingLeft: indent }}
          onClick={() => onSelect(node.path)}
          title={node.path}
        >
          <span className="tree-chevron" aria-hidden />
          <FileIcon name={node.name} />
          <span className="tree-label">{node.name}</span>
        </button>,
      ];
    });

  return <div className="tree">{renderNodes(root.children, 0)}</div>;
}
