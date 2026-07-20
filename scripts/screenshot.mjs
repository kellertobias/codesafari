#!/usr/bin/env node
/**
 * Regenerate the README hero image end to end:
 *
 *   1. Run the Playwright screenshot spec, which boots the dev server, opens
 *      the viewer mid-tour with the file tree + a file open, and writes the raw
 *      capture to `docs/viewer-explorer.png`.
 *   2. Wrap that capture in realistic dark-mode Safari chrome using the vendored
 *      `browsershot` tool (https://github.com/kellertobias/browsershot),
 *      producing `docs/viewer-explorer.safari.png` — the image the README uses.
 *
 * browsershot is a macOS Python tool (Pillow + system fonts / SF Symbols). We
 * keep an isolated virtualenv under `scripts/.venv` so `npm run screenshot`
 * works without touching the system Python.
 *
 * Run with: `npm run screenshot`
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs');
const rawShot = path.join(docsDir, 'viewer-explorer.png');
const framedShot = path.join(docsDir, 'viewer-explorer.safari.png');
const browsershot = path.join(__dirname, 'browsershot');
const venvDir = path.join(__dirname, '.venv');
const venvPython = path.join(venvDir, 'bin', 'python');

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: repoRoot, ...opts });
  if (res.status !== 0) {
    console.error(`\nCommand failed (exit ${res.status}): ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

// 1. Capture the raw viewer screenshot into docs/.
run('npx', ['playwright', 'test', 'e2e/screenshot.spec.ts']);

if (!existsSync(rawShot)) {
  console.error(`Expected screenshot not produced: ${rawShot}`);
  process.exit(1);
}

// 2. Frame it with browsershot (macOS only).
if (process.platform !== 'darwin') {
  console.warn(
    '\nbrowsershot needs macOS (Safari chrome + SF Symbols); skipping the ' +
      `framing step. Raw screenshot is at ${path.relative(repoRoot, rawShot)}.`,
  );
  process.exit(0);
}

// Ensure an isolated venv with Pillow for browsershot.
if (!existsSync(venvPython)) {
  console.log('\nCreating Python virtualenv for browsershot…');
  run('python3', ['-m', 'venv', venvDir]);
  run(venvPython, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip', 'Pillow']);
}

run(venvPython, [
  browsershot,
  rawShot,
  '--address', 'localhost:4317',
  '--output', framedShot,
]);

console.log(
  `\nDone.\n  raw:    ${path.relative(repoRoot, rawShot)}\n  framed: ${path.relative(repoRoot, framedShot)}`,
);
