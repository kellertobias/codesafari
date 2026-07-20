/**
 * App-wide "open file" state, shared by the left code surface and everything
 * that can reference a file (the tree, tour steps, and Markdown links).
 *
 * The viewer is a two-region shell: the **left** is a code surface (a
 * togglable file tree plus a read-only code viewer) and the **right** is
 * whatever page or tour you're on. Opening a file only touches the left, so the
 * right keeps whatever is currently there.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LineRange, SourceFile } from '../../src/model/types';

interface FileStore {
  files: SourceFile[];
  /** Path of the file shown in the code surface, or null if none is open. */
  openPath: string | null;
  /** Range to highlight/scroll to, or null to show the file with no band. */
  highlight: LineRange | null;
  /** Whether the file tree is expanded. */
  treeOpen: boolean;
  /** Open a file, optionally scrolling to a single line. */
  openFile: (path: string, line?: number) => void;
  /** Open a file and highlight an explicit range (used by tour steps). */
  openRange: (path: string, range: LineRange | null) => void;
  /** Close the code surface, giving the right side full width again. */
  closeFile: () => void;
  toggleTree: () => void;
}

const Ctx = createContext<FileStore | null>(null);

export function FileProvider({
  files,
  children,
}: {
  files: SourceFile[];
  children: ReactNode;
}): JSX.Element {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<LineRange | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);

  const openRange = useCallback((path: string, range: LineRange | null) => {
    setOpenPath(path);
    setHighlight(range);
  }, []);

  const openFile = useCallback(
    (path: string, line?: number) => {
      openRange(path, line ? { start: line, end: line } : null);
    },
    [openRange],
  );

  const closeFile = useCallback(() => {
    setOpenPath(null);
    setHighlight(null);
  }, []);

  const toggleTree = useCallback(() => setTreeOpen((v) => !v), []);

  const value = useMemo<FileStore>(
    () => ({
      files,
      openPath,
      highlight,
      treeOpen,
      openFile,
      openRange,
      closeFile,
      toggleTree,
    }),
    [files, openPath, highlight, treeOpen, openFile, openRange, closeFile, toggleTree],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFileStore(): FileStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useFileStore must be used within a FileProvider');
  return store;
}
