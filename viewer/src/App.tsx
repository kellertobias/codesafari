/** Top-level app: routing, top bar, and dev-mode live reload. */

import { useEffect, useState } from 'react';
import type { Manifest } from '../../src/model/types';
import { isDevMode, loadManifest } from './manifest';
import { href, useRoute } from './router';
import { FileProvider, useFileStore } from './fileStore';
import { ExplorerPane } from './ExplorerPane';
import { Landing } from './pages/Landing';
import { ComponentDetail } from './pages/ComponentDetail';
import { Glossary } from './pages/Glossary';
import { TourIntro } from './pages/TourIntro';
import { TourRunner } from './pages/TourRunner';

export function App(): JSX.Element {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const route = useRoute();

  useEffect(() => {
    loadManifest().then(setManifest).catch((e) => setError(String(e)));
  }, []);

  // Dev-mode live reload: reconnect and refetch the manifest on 'reload'.
  useEffect(() => {
    if (!isDevMode()) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      socket = new WebSocket(`${proto}://${location.host}`);
      socket.onmessage = (ev) => {
        try {
          if (JSON.parse(ev.data).type === 'reload') {
            loadManifest().then(setManifest).catch(() => undefined);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onclose = () => {
        retry = setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      clearTimeout(retry);
      socket?.close();
    };
  }, []);

  if (error) {
    return <div className="page"><h1>Error</h1><p className="empty">{error}</p></div>;
  }
  if (!manifest) {
    return <div className="page"><p className="empty">Loading…</p></div>;
  }

  return (
    <FileProvider files={manifest.files}>
      <Shell manifest={manifest} route={route} />
    </FileProvider>
  );
}

/**
 * The app chrome, rendered inside the {@link FileProvider} so it can drive the
 * shared file surface. Landing on the overview or a tour intro clears the open
 * files and tree by default — unless the user has opted to keep them open.
 */
function Shell({
  manifest,
  route,
}: {
  manifest: Manifest;
  route: ReturnType<typeof useRoute>;
}): JSX.Element {
  const { closeAll, keepFilesOpen, setKeepFilesOpen } = useFileStore();

  // On the overview (no segments) or a tour intro (`/tour/:slug`, not `/run`),
  // collapse the code surface unless the user chose to keep it open.
  const [head, , b] = route.segments;
  const isOverviewLike = head === undefined || (head === 'tour' && b !== 'run');
  useEffect(() => {
    if (isOverviewLike && !keepFilesOpen) closeAll();
    // Keyed on the raw hash so it re-runs on every navigation, not just when
    // the overview-like flag flips.
  }, [route.raw, isOverviewLike, keepFilesOpen, closeAll]);

  return (
    <div className="app">
      {isDevMode() && (
        <div className="banner">Live dev mode — edits reload automatically.</div>
      )}
      <header className="topbar">
        <a className="brand" href={href('/')}>
          code<span className="dot">·</span>safari
        </a>
        <nav>
          <a href={href('/')}>Overview</a>
          {manifest.glossary.length > 0 && <a href={href('/glossary')}>Glossary</a>}
        </nav>
        <span className="spacer" />
        <label className="keep-files" title="Keep open files when returning to the overview">
          <input
            type="checkbox"
            checked={keepFilesOpen}
            onChange={(e) => setKeepFilesOpen(e.target.checked)}
          />
          Keep files open
        </label>
        {manifest.project.repositoryUrl && (
          <a
            className="repo"
            href={manifest.project.repositoryUrl}
            target="_blank"
            rel="noreferrer"
          >
            Repository ↗
          </a>
        )}
      </header>
      <div className="body">
        <ExplorerPane />
        <main className="route">
          <Router manifest={manifest} segments={route.segments} />
        </main>
      </div>
    </div>
  );
}

// @tour viewer:2 Client-side routing
// A dependency-free hash router keeps the bundle small and the export portable.
// The path segments after `#/` select the page: the overview, a component, the
// glossary, a tour intro, or — when the third segment is `run` — the tour
// runner. No server routes, so it works from a static file.
function Router({
  manifest,
  segments,
}: {
  manifest: Manifest;
  segments: string[];
}): JSX.Element {
  const [head, a, b] = segments;

  switch (head) {
    case undefined:
      return <Landing manifest={manifest} />;
    case 'glossary':
      return <Glossary manifest={manifest} />;
    case 'component':
      return <ComponentDetail manifest={manifest} slug={a ?? ''} />;
    case 'tour':
      if (b === 'run') return <TourRunner manifest={manifest} slug={a ?? ''} />;
      return <TourIntro manifest={manifest} slug={a ?? ''} />;
    default:
      return <Landing manifest={manifest} />;
  }
}
