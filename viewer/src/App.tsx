/** Top-level app: routing, top bar, and dev-mode live reload. */

import { useEffect, useState } from 'react';
import type { Manifest } from '../../src/model/types';
import { isDevMode, loadManifest } from './manifest';
import { href, useRoute } from './router';
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

  const isRunner =
    route.segments[0] === 'tour' && route.segments[2] === 'run';

  return (
    <div className="app">
      {isDevMode() && <div className="banner">Live dev mode — edits reload automatically.</div>}
      {!isRunner && (
        <header className="topbar">
          <a className="brand" href={href('/')}>
            code<span className="dot">·</span>safari
          </a>
          <nav>
            <a href={href('/')}>Overview</a>
            {manifest.glossary.length > 0 && <a href={href('/glossary')}>Glossary</a>}
          </nav>
          <span className="spacer" />
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
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Router manifest={manifest} segments={route.segments} />
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
