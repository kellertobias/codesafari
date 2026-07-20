import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IgnoreMatcher } from './ignore.js';

describe('IgnoreMatcher', () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'codesafari-ignore-'));
    await fs.writeFile(path.join(root, '.gitignore'), 'dist/\n*.log\n');
    await fs.writeFile(path.join(root, '.codesafariignore'), 'secret/\n');
    await fs.mkdir(path.join(root, '.tour'), { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('honors .gitignore patterns', async () => {
    const m = await IgnoreMatcher.load(root);
    expect(m.ignores(path.join(root, 'dist', 'a.js'))).toBe(true);
    expect(m.ignores(path.join(root, 'app.log'))).toBe(true);
    expect(m.ignores(path.join(root, 'src', 'a.ts'))).toBe(false);
  });

  it('combines .codesafariignore patterns', async () => {
    const m = await IgnoreMatcher.load(root);
    expect(m.ignores(path.join(root, 'secret', 'key.ts'))).toBe(true);
  });

  it('always keeps .tour/ content even when broadly ignored', async () => {
    await fs.writeFile(path.join(root, '.gitignore'), '*.md\ndist/\n');
    const m = await IgnoreMatcher.load(root);
    expect(m.ignores(path.join(root, '.tour', 'index.md'))).toBe(false);
    expect(m.ignores(path.join(root, 'README.md'))).toBe(true);
  });

  it('always ignores node_modules and .git', async () => {
    const m = await IgnoreMatcher.load(root);
    expect(m.ignores(path.join(root, 'node_modules', 'x', 'i.js'))).toBe(true);
    expect(m.ignores(path.join(root, '.git', 'config'))).toBe(true);
  });
});
