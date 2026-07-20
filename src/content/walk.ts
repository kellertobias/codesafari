/** Recursively walk a directory, yielding absolute file paths. */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IgnoreMatcher } from '../ignore/ignore.js';

export interface WalkOptions {
  /** When provided, files/dirs the matcher ignores are skipped. */
  ignore?: IgnoreMatcher;
  /** When provided, only files whose path passes this filter are yielded. */
  filter?: (absPath: string) => boolean;
}

/** Yield absolute paths of all files under `dir`, honoring ignore rules. */
export async function* walk(
  dir: string,
  options: WalkOptions = {},
): AsyncGenerator<string> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // Missing directory: nothing to yield.
  }

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (options.ignore?.ignores(abs)) continue;

    if (entry.isDirectory()) {
      yield* walk(abs, options);
    } else if (entry.isFile()) {
      if (options.filter && !options.filter(abs)) continue;
      yield abs;
    }
  }
}

/** Collect an async iterable into an array. */
export async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of it) out.push(item);
  return out;
}
