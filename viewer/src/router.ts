/** Minimal dependency-free hash router (keeps the bundle small and offline). */

import { useEffect, useState } from 'react';

export interface Route {
  /** Path segments after `#/`, e.g. ["tour", "onboarding"]. */
  segments: string[];
  /** The fragment after a second `#`, e.g. glossary anchor. */
  anchor: string | null;
  /** Raw hash for equality checks. */
  raw: string;
}

function parse(hash: string): Route {
  // hash like "#/tour/onboarding#step-2"
  const withoutHash = hash.replace(/^#/, '');
  const [pathPart, anchor] = withoutHash.split('#');
  const segments = pathPart.split('/').filter(Boolean);
  return { segments, anchor: anchor ?? null, raw: hash };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parse(window.location.hash || '#/'),
  );
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash || '#/'));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function href(path: string): string {
  return `#${path}`;
}
