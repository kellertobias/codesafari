/**
 * App-wide open-file state, shared by the left code surface and everything that
 * can reference a file (the tree, tour steps, and Markdown links).
 *
 * The viewer is a two-region shell: the **left** is a code surface (a togglable
 * file tree plus a tabbed, read-only code viewer) and the **right** is whatever
 * page or tour you're on. Opening a file only touches the left, so the right
 * keeps whatever is currently there.
 *
 * Multiple files open as **tabs**; a newly opened file is appended to the right.
 * A highlight belongs to the file it was opened for, so switching to another
 * tab shows that file without a stray band, and switching back restores it.
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

/**
 * The sidebar shows one pane at a time, selected from the activity bar:
 * `files` browses the repository's source, `docs` browses the authored
 * documentation tree from `.tour/docs`.
 */
export type SidePanel = 'files' | 'docs';

interface FileStore {
  files: SourceFile[];
  /** Open files, in tab order (left → right). */
  tabs: string[];
  /** The focused tab's path, or null when nothing is open. */
  activePath: string | null;
  /** The active (focus) highlight range (applies only to {@link highlightPath}). */
  highlight: LineRange | null;
  /**
   * A wider surrounding range shown as banded context while the rest of the
   * file is faded — used for detail sub-steps, where this is the parent step.
   */
  context: LineRange | null;
  /** The file the current highlight/context belongs to. */
  highlightPath: string | null;
  /** Which sidebar pane is showing, or null when the sidebar is collapsed. */
  panel: SidePanel | null;
  /** Open/focus a file, optionally scrolling to a single line. */
  openFile: (path: string, line?: number) => void;
  /**
   * Open/focus a file and highlight an explicit range (tour steps/details).
   * An optional `context` range is banded while everything outside it fades.
   */
  openRange: (
    path: string,
    range: LineRange | null,
    context?: LineRange | null,
  ) => void;
  /** Focus an already-open tab without changing its highlight. */
  activateTab: (path: string) => void;
  /** Close a tab; focus a neighbour if it was active. */
  closeTab: (path: string) => void;
  /** Close every tab and the sidebar, clearing the whole left surface. */
  closeAll: () => void;
  /** Show a sidebar pane, or collapse the sidebar if it is already showing. */
  togglePanel: (panel: SidePanel) => void;
  /** Show a sidebar pane unconditionally. */
  showPanel: (panel: SidePanel) => void;
  /**
   * When true, returning to the overview / a tour intro keeps open files and
   * the tree instead of closing them. Persisted to localStorage.
   */
  keepFilesOpen: boolean;
  setKeepFilesOpen: (value: boolean) => void;
}

const KEEP_FILES_KEY = 'codesafari:keepFilesOpen';

function readKeepFilesOpen(): boolean {
  try {
    return localStorage.getItem(KEEP_FILES_KEY) === '1';
  } catch {
    return false;
  }
}

const Ctx = createContext<FileStore | null>(null);

export function FileProvider({
  files,
  children,
}: {
  files: SourceFile[];
  children: ReactNode;
}): JSX.Element {
  const [tabs, setTabs] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<LineRange | null>(null);
  const [context, setContext] = useState<LineRange | null>(null);
  const [highlightPath, setHighlightPath] = useState<string | null>(null);
  const [panel, setPanel] = useState<SidePanel | null>(null);
  const [keepFilesOpen, setKeepFilesOpenState] = useState(readKeepFilesOpen);

  const openRange = useCallback(
    (path: string, range: LineRange | null, ctx: LineRange | null = null) => {
      // Append to the right if the file isn't already open.
      setTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActivePath(path);
      setHighlight(range);
      setContext(ctx);
      setHighlightPath(range ? path : null);
    },
    [],
  );

  const openFile = useCallback(
    (path: string, line?: number) => {
      openRange(path, line ? { start: line, end: line } : null);
    },
    [openRange],
  );

  const activateTab = useCallback((path: string) => setActivePath(path), []);

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const idx = prev.indexOf(path);
        if (idx === -1) return prev;
        const next = prev.filter((p) => p !== path);
        setActivePath((current) => {
          if (current !== path) return current;
          // Focus the tab that slid into this slot, else its left neighbour.
          return next[idx] ?? next[idx - 1] ?? null;
        });
        return next;
      });
    },
    [],
  );

  const closeAll = useCallback(() => {
    setTabs([]);
    setActivePath(null);
    setHighlight(null);
    setContext(null);
    setHighlightPath(null);
    setPanel(null);
  }, []);

  const togglePanel = useCallback(
    (next: SidePanel) => setPanel((current) => (current === next ? null : next)),
    [],
  );

  const showPanel = useCallback((next: SidePanel) => setPanel(next), []);

  const setKeepFilesOpen = useCallback((value: boolean) => {
    setKeepFilesOpenState(value);
    try {
      localStorage.setItem(KEEP_FILES_KEY, value ? '1' : '0');
    } catch {
      /* ignore unavailable storage */
    }
  }, []);

  const value = useMemo<FileStore>(
    () => ({
      files,
      tabs,
      activePath,
      highlight,
      context,
      highlightPath,
      panel,
      openFile,
      openRange,
      activateTab,
      closeTab,
      closeAll,
      togglePanel,
      showPanel,
      keepFilesOpen,
      setKeepFilesOpen,
    }),
    [
      files,
      tabs,
      activePath,
      highlight,
      context,
      highlightPath,
      panel,
      openFile,
      openRange,
      activateTab,
      closeTab,
      closeAll,
      togglePanel,
      showPanel,
      keepFilesOpen,
      setKeepFilesOpen,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFileStore(): FileStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useFileStore must be used within a FileProvider');
  return store;
}
