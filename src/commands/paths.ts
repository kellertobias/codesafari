/** Locate package-bundled runtime assets (the prebuilt viewer). */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path to the package root (the dir containing package.json). */
export function packageRoot(): string {
  // This file lives at dist/commands/paths.js after build → up two levels.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

/** Absolute path to the prebuilt viewer directory shipped in the package. */
export function viewerDistDir(): string {
  return path.join(packageRoot(), 'viewer-dist');
}

/** True if the prebuilt viewer assets are present. */
export async function viewerBuilt(): Promise<boolean> {
  try {
    await fs.access(path.join(viewerDistDir(), 'index.html'));
    return true;
  } catch {
    return false;
  }
}
