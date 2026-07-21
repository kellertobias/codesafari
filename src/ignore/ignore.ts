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

/**
 * Files that must never reach a bundle, even when no ignore file mentions them
 * and even under `.tour/`. A project that forgot to gitignore its credentials
 * should not have them published by us.
 */
const SECRETS = [
  // Environment files, but keep the checked-in templates.
  '.env',
  '.env.*',
  '!.env.example',
  '!.env.sample',
  '!.env.template',
  '!.env.*.example',
  // Keys and certificates.
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.jks',
  '*.keystore',
  '*.ppk',
  '*.asc',
  '*.gpg',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  '.ssh/',
  // Cloud and tool credentials.
  '.aws/',
  '.gnupg/',
  '.netrc',
  '.npmrc',
  '.pypirc',
  '.htpasswd',
  'credentials',
  'credentials.json',
  'secrets.json',
  'secrets.y*ml',
  '*.secret',
  '*secrets.env',
  'service-account*.json',
  'gha-creds-*.json',
  'terraform.tfstate',
  'terraform.tfstate.backup',
  '*.tfvars',
];

export class IgnoreMatcher {
  private constructor(
    private readonly root: string,
    private readonly matcher: Ignore,
    private readonly secrets: Ignore,
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

    return new IgnoreMatcher(root, matcher, ignoreFactory().add(SECRETS));
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

    // Secrets win over every other rule, including the `.tour/` exception.
    if (this.secrets.ignores(normalized)) return true;

    // `.tour/` content is always included.
    if (normalized === '.tour' || normalized.startsWith('.tour/')) return false;

    return this.matcher.ignores(normalized);
  }
}
