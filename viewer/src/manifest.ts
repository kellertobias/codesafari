/** Load the CodeSafari manifest, in both dev (fetch) and export (inline) modes. */

import type { Manifest } from '../../src/model/types';

declare global {
  interface Window {
    __CODESAFARI_MANIFEST__?: Manifest;
  }
}

/**
 * In `export` output the manifest is injected as `window.__CODESAFARI_MANIFEST__`
 * (so the site works from `file://` with no fetch). In `dev` it is served at
 * `/data/manifest.json` and re-fetched on live-reload signals.
 */
// @tour viewer:1 Loading the manifest
// The frontend's single input. In an exported site the manifest is inlined as
// `window.__CODESAFARI_MANIFEST__` (so it works from file:// with no fetch); under
// the dev server it's fetched from /data/manifest.json and re-fetched on every
// live-reload signal. Everything else the viewer draws comes from this object.
export async function loadManifest(): Promise<Manifest> {
  if (window.__CODESAFARI_MANIFEST__) {
    return window.__CODESAFARI_MANIFEST__;
  }
  const res = await fetch('./data/manifest.json');
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  return (await res.json()) as Manifest;
}

/** True when running under the dev server (manifest is fetched, live-reloads). */
export function isDevMode(): boolean {
  return !window.__CODESAFARI_MANIFEST__;
}
