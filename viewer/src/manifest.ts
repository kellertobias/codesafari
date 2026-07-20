/** Load the Code Tour manifest, in both dev (fetch) and export (inline) modes. */

import type { Manifest } from '../../src/model/types';

declare global {
  interface Window {
    __CODETOUR_MANIFEST__?: Manifest;
  }
}

/**
 * In `export` output the manifest is injected as `window.__CODETOUR_MANIFEST__`
 * (so the site works from `file://` with no fetch). In `dev` it is served at
 * `/data/manifest.json` and re-fetched on live-reload signals.
 */
export async function loadManifest(): Promise<Manifest> {
  if (window.__CODETOUR_MANIFEST__) {
    return window.__CODETOUR_MANIFEST__;
  }
  const res = await fetch('./data/manifest.json');
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  return (await res.json()) as Manifest;
}

/** True when running under the dev server (manifest is fetched, live-reloads). */
export function isDevMode(): boolean {
  return !window.__CODETOUR_MANIFEST__;
}
