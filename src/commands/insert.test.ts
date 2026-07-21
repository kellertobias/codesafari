import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInsert } from './insert.js';
import { scanComments } from '../parser/comments.js';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'codesafari-insert-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
}

async function read(rel: string): Promise<string> {
  return fs.readFile(path.join(root, rel), 'utf8');
}

async function spec(entries: unknown[]): Promise<string> {
  const p = path.join(root, 'spec.json');
  await fs.writeFile(p, JSON.stringify(entries), 'utf8');
  return p;
}

describe('runInsert', () => {
  it('inserts a step above the anchor and the parser reads it back', async () => {
    await write('src/a.ts', ['const x = 1;', '', 'export function go() {', '  return x;', '}', ''].join('\n'));

    const result = await runInsert(root, await spec([
      {
        file: 'src/a.ts',
        line: 3,
        match: 'export function go',
        tour: 'demo',
        order: '10',
        title: 'Entry point',
        body: ['First paragraph.', 'Second paragraph.'],
      },
    ]));

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(1);

    const out = await read('src/a.ts');
    const [comment] = scanComments(out);
    expect(comment.kind).toBe('step');
    expect(comment.tourSlug).toBe('demo');
    expect(comment.order).toBe('10');
    expect(comment.title).toBe('Entry point');
    // The blank comment line keeps the two paragraphs separate in Markdown.
    expect(comment.body).toContain('First paragraph.\n\nSecond paragraph.');
    // It must anchor the function, not fall back to a snippet.
    const lines = out.split('\n');
    expect(lines[comment.nextCodeLine! - 1]).toContain('export function go');
  });

  it('uses # for Python instead of //', async () => {
    await write('src/a.py', ['def go():\n    return 1\n'].join(''));

    await runInsert(root, await spec([
      { file: 'src/a.py', line: 1, match: 'def go', tour: 'demo', order: '10', title: 'Go', body: 'Does it.' },
    ]));

    const out = await read('src/a.py');
    expect(out).toContain('# @tour demo:10 Go');
    expect(out).not.toContain('//');
    expect(scanComments(out)[0].title).toBe('Go');
  });

  it('hoists above a Rust attribute, which the scanner treats as a comment', async () => {
    await write('src/a.rs', ['#[derive(Debug)]', 'pub struct Thing {', '    id: u32,', '}', ''].join('\n'));

    await runInsert(root, await spec([
      { file: 'src/a.rs', line: 2, match: 'pub struct Thing', tour: 'demo', order: '10', title: 'The struct' },
    ]));

    const out = await read('src/a.rs');
    const lines = out.split('\n');
    // Inserted block sits above the attribute...
    expect(lines[0]).toBe('// @tour demo:10 The struct');
    expect(lines.indexOf('#[derive(Debug)]')).toBeGreaterThan(0);
    // ...and is still read as a step whose next code line is the struct.
    const [comment] = scanComments(out);
    expect(comment.kind).toBe('step');
    expect(lines[comment.nextCodeLine! - 1]).toContain('pub struct Thing');
  });

  it('stays below a Python decorator so the def remains the anchor', async () => {
    await write('src/a.py', ['@app.route("/x")', 'def handler():', '    return 1', ''].join('\n'));

    await runInsert(root, await spec([
      { file: 'src/a.py', line: 2, match: 'def handler', tour: 'demo', order: '10', title: 'Handler' },
    ]));

    const out = await read('src/a.py');
    const lines = out.split('\n');
    expect(lines[0]).toBe('@app.route("/x")');
    expect(lines[1]).toBe('# @tour demo:10 Handler');
    const [comment] = scanComments(out);
    expect(lines[comment.nextCodeLine! - 1]).toContain('def handler');
  });

  it('follows drift when the line hint is stale but the match is unique', async () => {
    await write('src/a.ts', ['', '', '', '', 'export function go() {}', ''].join('\n'));

    const result = await runInsert(root, await spec([
      { file: 'src/a.ts', line: 1, match: 'export function go', tour: 'demo', order: '10', title: 'Go' },
    ]));

    expect(result.ok).toBe(true);
    const out = await read('src/a.ts');
    expect(out.split('\n')[4]).toBe('// @tour demo:10 Go');
  });

  it('refuses an ambiguous match and writes nothing', async () => {
    const original = ['call();', 'call();', ''].join('\n');
    await write('src/a.ts', original);

    const result = await runInsert(root, await spec([
      { file: 'src/a.ts', match: 'call()', tour: 'demo', order: '10', title: 'Call' },
    ]));

    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(/2 lines contain/);
    expect(await read('src/a.ts')).toBe(original);
  });

  it('trusts an exact line hint even when the match repeats elsewhere', async () => {
    await write('src/a.ts', ['call();', 'call();', ''].join('\n'));

    const result = await runInsert(root, await spec([
      { file: 'src/a.ts', line: 2, match: 'call()', tour: 'demo', order: '10', title: 'Call' },
    ]));

    expect(result.ok).toBe(true);
    expect((await read('src/a.ts')).split('\n')[1]).toBe('// @tour demo:10 Call');
  });

  it('writes nothing at all when any entry in the spec fails', async () => {
    const a = 'export function go() {}\n';
    await write('src/a.ts', a);
    await write('src/b.ts', 'export function stop() {}\n');

    const result = await runInsert(root, await spec([
      { file: 'src/a.ts', match: 'export function go', tour: 'demo', order: '10', title: 'Go' },
      { file: 'src/b.ts', match: 'does not exist', tour: 'demo', order: '20', title: 'Nope' },
    ]));

    expect(result.ok).toBe(false);
    // The resolvable entry must not have been applied.
    expect(await read('src/a.ts')).toBe(a);
  });

  it('is idempotent — a second run inserts nothing', async () => {
    await write('src/a.ts', 'export function go() {}\n');
    const entries = [
      { file: 'src/a.ts', match: 'export function go', tour: 'demo', order: '10', title: 'Go', body: 'Body.' },
    ];

    await runInsert(root, await spec(entries));
    const afterFirst = await read('src/a.ts');

    const second = await runInsert(root, await spec(entries));
    expect(second.applied).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await read('src/a.ts')).toBe(afterFirst);
  });

  it('applies multiple entries in one file without drifting later anchors', async () => {
    await write('src/a.ts', [
      'export function one() {}',
      '',
      'export function two() {}',
      '',
      'export function three() {}',
      '',
    ].join('\n'));

    const result = await runInsert(root, await spec([
      { file: 'src/a.ts', line: 1, match: 'function one', tour: 'demo', order: '10', title: 'One' },
      { file: 'src/a.ts', line: 3, match: 'function two', tour: 'demo', order: '20', title: 'Two' },
      { file: 'src/a.ts', line: 5, match: 'function three', tour: 'demo', order: '30', title: 'Three' },
    ]));

    expect(result.applied).toBe(3);
    const out = await read('src/a.ts');
    const comments = scanComments(out);
    expect(comments.map((c) => c.title)).toEqual(['One', 'Two', 'Three']);
    const lines = out.split('\n');
    for (const c of comments) {
      expect(lines[c.nextCodeLine! - 1]).toContain(`function ${c.title.toLowerCase()}`);
    }
  });

  it('supports callouts', async () => {
    await write('src/a.ts', 'const cache = new Map();\n');

    await runInsert(root, await spec([
      { file: 'src/a.ts', match: 'const cache', tour: 'comment', title: 'Not thread-safe' },
    ]));

    const [comment] = scanComments(await read('src/a.ts'));
    expect(comment.kind).toBe('callout');
    expect(comment.title).toBe('Not thread-safe');
  });

  it('rejects an unsupported file type rather than guessing a marker', async () => {
    await write('a.txt', 'hello\n');

    const result = await runInsert(root, await spec([
      { file: 'a.txt', match: 'hello', tour: 'demo', order: '10', title: 'Hi' },
    ]));

    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(/unsupported file type/);
  });

  it('rejects an invalid order key', async () => {
    await write('src/a.ts', 'export function go() {}\n');

    const result = await runInsert(root, await spec([
      { file: 'src/a.ts', match: 'function go', tour: 'demo', order: 'abc', title: 'Go' },
    ]));

    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(/invalid order key/);
  });

  it('preserves indentation and CRLF line endings', async () => {
    await write('src/a.ts', 'class A {\r\n  method() {\r\n    return 1;\r\n  }\r\n}\r\n');

    await runInsert(root, await spec([
      { file: 'src/a.ts', match: '  method()', tour: 'demo', order: '10', title: 'M' },
    ]));

    const out = await read('src/a.ts');
    expect(out).toContain('\r\n');
    expect(out).not.toMatch(/[^\r]\n/);
    expect(out).toContain('  // @tour demo:10 M');
  });

  it('dry run reports without writing', async () => {
    const original = 'export function go() {}\n';
    await write('src/a.ts', original);

    const result = await runInsert(
      root,
      await spec([{ file: 'src/a.ts', match: 'function go', tour: 'demo', order: '10', title: 'Go' }]),
      { dryRun: true },
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(1);
    expect(await read('src/a.ts')).toBe(original);
  });
});
