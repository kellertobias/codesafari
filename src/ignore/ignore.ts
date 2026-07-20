/**
 * Path filtering using `.gitignore` + `.codesafariignore`.
 *
 * Both files use gitignore syntax and are combined. `.tour/` content is always
 * kept, even when a broad pattern (e.g. `*.md`) would otherwise match it, so
 * authored docs never disappear from the site.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import ignoreImport, { type Ignore } from 'ignore';

// The `ignore` package is CommonJS (`module.exports = fn`); under NodeNext its
// runtime default export is the callable factory, but the bundled types model
// it as a namespace. Cast through `unknown` to a factory signature.
const ignoreFactory = ignoreImport as unknown as (options?: unknown) => Ignore;

const IGNORE_FILES = ['.gitignore', '.codesafariignore'];

/** Directories that are always excluded regardless of ignore files. */
const ALWAYS_IGNORE = ['.git', 'node_modules'];

export class IgnoreMatcher {
  private constructor(
    private readonly root: string,
    private readonly matcher: Ignore,
  ) {}

  /** Build a matcher by reading ignore files at the project root. */
  static async load(root: string): Promise<IgnoreMatcher> {
    const matcher = ignoreFactory();
    matcher.add(ALWAYS_IGNORE);

    for (const name of IGNORE_FILES) {
      const file = path.join(root, name);
      try {
        const content = await fs.readFile(file, 'utf8');
        matcher.add(content);
      } catch {
        // Missing ignore files are fine.
      }
    }

    return new IgnoreMatcher(root, matcher);
  }

  /** The ignore-file basenames this matcher watches, for file watching. */
  static get files(): readonly string[] {
    return IGNORE_FILES;
  }

  /**
   * @param absPath An absolute path inside the project root.
   * @returns true if the path should be excluded from parsing/serving/export.
   */
  ignores(absPath: string): boolean {
    const rel = path.relative(this.root, absPath);
    if (rel === '' || rel.startsWith('..')) return false;
    const normalized = rel.split(path.sep).join('/');

    // `.tour/` content is always included.
    if (normalized === '.tour' || normalized.startsWith('.tour/')) return false;

    return this.matcher.ignores(normalized);
  }
}
