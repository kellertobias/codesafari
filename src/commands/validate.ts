/** `codetour validate` — parse all content and report problems. */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Diagnostic } from '../model/types.js';
import { buildManifest } from '../manifest/build.js';

export interface ValidateResult {
  ok: boolean;
  errors: number;
  warnings: number;
}

/** Build the manifest and print diagnostics. Returns a pass/fail summary. */
export async function runValidate(root: string): Promise<ValidateResult> {
  const resolved = path.resolve(root);
  await assertTourDir(resolved);

  const { manifest, diagnostics } = await buildManifest(resolved);

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  printSummary(manifest, diagnostics);

  const ok = errors.length === 0;
  return { ok, errors: errors.length, warnings: warnings.length };
}

async function assertTourDir(root: string): Promise<void> {
  const tourDir = path.join(root, '.tour');
  try {
    const stat = await fs.stat(tourDir);
    if (!stat.isDirectory()) throw new Error('not a directory');
  } catch {
    throw new Error(
      `No .tour/ directory found in ${root}. Create one with a .tour/index.md to get started.`,
    );
  }
}

function printSummary(
  manifest: Awaited<ReturnType<typeof buildManifest>>['manifest'],
  diagnostics: Diagnostic[],
): void {
  const stepCount = manifest.tours.reduce((n, t) => n + t.steps.length, 0);
  console.log(`Project: ${manifest.project.title}`);
  console.log(
    `  ${manifest.components.length} component(s), ${manifest.tours.length} tour(s), ` +
      `${stepCount} step(s), ${manifest.glossary.length} glossary concept(s), ` +
      `${manifest.callouts.length} callout(s).`,
  );

  for (const d of diagnostics) {
    const location = d.file ? `${d.file}${d.line ? `:${d.line}` : ''}` : '';
    const tag = d.severity === 'error' ? 'error' : 'warn';
    console.log(`  ${tag}  ${location ? `${location}  ` : ''}${d.message}`);
  }

  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  if (errors === 0 && warnings === 0) {
    console.log('No problems found.');
  } else {
    console.log(`${errors} error(s), ${warnings} warning(s).`);
  }
}
