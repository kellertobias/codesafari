/**
 * Shared state for the glossary side-panel — a right-hand drawer that can be
 * opened from anywhere (a `glossary:` link in Markdown, the top-bar button, the
 * landing page) so concepts can be looked up without leaving a tour or closing
 * an open file.
 *
 * `focus` carries the concept to scroll to plus a monotonic `seq`, so clicking
 * the same concept twice still re-triggers the scroll.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface GlossaryStore {
  open: boolean;
  /** The concept to reveal, and a bump counter so repeat opens re-scroll. */
  focus: { slug: string | null; seq: number };
  /** Open the panel, optionally scrolling to (and revealing) a concept. */
  openGlossary: (slug?: string) => void;
  closeGlossary: () => void;
}

const Ctx = createContext<GlossaryStore | null>(null);

export function GlossaryProvider({ children }: { children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<{ slug: string | null; seq: number }>({
    slug: null,
    seq: 0,
  });

  const openGlossary = useCallback((slug?: string) => {
    setOpen(true);
    setFocus((prev) => ({ slug: slug ?? null, seq: prev.seq + 1 }));
  }, []);

  const closeGlossary = useCallback(() => setOpen(false), []);

  const value = useMemo<GlossaryStore>(
    () => ({ open, focus, openGlossary, closeGlossary }),
    [open, focus, openGlossary, closeGlossary],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGlossary(): GlossaryStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useGlossary must be used within a GlossaryProvider');
  return store;
}
