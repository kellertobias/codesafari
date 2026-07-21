/** Keep generated output out of version control. */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const MARKER = '# codesafari generated output';

/**
 * Add `outDir` to the project's `.gitignore`, creating the file if needed.
 * Paths outside the project root are left alone — we only manage entries we can
 * express relative to the repository. Returns the entry written, or null if
 * nothing was needed.
 */
export async function ignoreOutput(
  root: string,
  outDir: string,
): Promise<string | null> {
  const rel = path.relative(root, outDir);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;

  const entry = `/${rel.split(path.sep).join('/')}/`;
  const file = path.join(root, '.gitignore');

  let existing = '';
  try {
    existing = await fs.readFile(file, 'utf8');
  } catch {
    // No .gitignore yet — we write a fresh one below.
  }

  const lines = existing.split('\n').map((l) => l.trim());
  if (lines.includes(entry) || lines.includes(entry.slice(1, -1))) return null;

  const prefix = existing === '' || existing.endsWith('\n') ? '' : '\n';
  await fs.appendFile(file, `${prefix}\n${MARKER}\n${entry}\n`, 'utf8');
  return entry;
}
