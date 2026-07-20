/** `codesafari export` — write a self-contained static site. */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildManifest } from '../manifest/build.js';
import { viewerBuilt, viewerDistDir } from './paths.js';

export interface ExportOptions {
  out: string;
}

export interface ExportResult {
  ok: boolean;
  outDir: string;
  fileCount: number;
  errors: number;
}

// @tour pipeline:5 Freezing a static site
// The same manifest, made portable. `export` builds it with source content
// bundled in, copies the prebuilt viewer, and writes the manifest as both JSON
// and an inline `window.__CODESAFARI_MANIFEST__` script — so the exported site
// runs from `file://` with no server and no network.
/**
 * Build a frozen manifest with bundled source content, then copy the prebuilt
 * viewer and write the manifest alongside it. The result runs offline with no
 * backend.
 */
export async function runExport(
  root: string,
  options: ExportOptions,
): Promise<ExportResult> {
  const resolved = path.resolve(root);
  const outDir = path.resolve(options.out);

  const { manifest, diagnostics } = await buildManifest(resolved, {
    bundleSources: true,
  });
  const errors = diagnostics.filter((d) => d.severity === 'error');
  for (const d of diagnostics) {
    const location = d.file ? `${d.file}${d.line ? `:${d.line}` : ''}  ` : '';
    console.log(`  ${d.severity === 'error' ? 'error' : 'warn'}  ${location}${d.message}`);
  }
  if (errors.length > 0) {
    console.error(`Export aborted: ${errors.length} error(s). Fix them and retry.`);
    return { ok: false, outDir, fileCount: 0, errors: errors.length };
  }

  if (!(await viewerBuilt())) {
    throw new Error(
      'Prebuilt viewer assets are missing (viewer-dist/). Run `npm run build:viewer` before exporting from source.',
    );
  }

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  // Copy the prebuilt viewer.
  await copyDir(viewerDistDir(), outDir);

  // Write the frozen manifest as a JS module and JSON, so the static viewer can
  // load it with a plain <script> (no fetch needed for file:// use).
  await fs.mkdir(path.join(outDir, 'data'), { recursive: true });
  const json = JSON.stringify(manifest);
  await fs.writeFile(path.join(outDir, 'data', 'manifest.json'), json, 'utf8');
  await fs.writeFile(
    path.join(outDir, 'data', 'manifest.js'),
    `window.__CODESAFARI_MANIFEST__ = ${json};`,
    'utf8',
  );

  console.log(`Exported static site to ${outDir}`);
  console.log(`  ${manifest.files.length} source file(s) bundled.`);
  return {
    ok: true,
    outDir,
    fileCount: manifest.files.length,
    errors: 0,
  };
}

/** Recursively copy a directory tree. */
async function copyDir(from: string, to: string): Promise<void> {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dest);
    } else {
      await fs.copyFile(src, dest);
    }
  }
}
