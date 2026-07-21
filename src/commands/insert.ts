/**
 * `codesafari insert` — write `@tour` comments into source files from a spec.
 *
 * Authoring a tour means placing many comments in many files, and placement is
 * load-bearing: {@link ../parser/comments.ts} merges consecutive comment lines
 * into one block and only reads `@tour` on a block's *first* line, so a comment
 * dropped underneath a doc comment or a Rust `#[attr]` silently stops being a
 * step. This command encodes those rules once instead of leaving every author
 * (human or agent) to rediscover them.
 *
 * Two properties matter for unattended use:
 *   - **All-or-nothing.** Every entry is resolved before any file is written,
 *     so a spec with one bad anchor leaves the tree untouched.
 *   - **Idempotent.** An entry whose header already exists in the file is
 *     skipped, so re-running a corrected spec cannot duplicate comments.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { languageForPath, type Language } from '../parser/resolveTarget.js';
import { isValidOrderKey } from '../parser/ordering.js';

/** One comment to insert. `line` is a hint; `match` is the real anchor. */
export interface InsertEntry {
  /** Project-relative path of the source file. */
  file: string;
  /** Expected 1-based line of the anchor. Optional; `match` decides. */
  line?: number;
  /** Text that must appear in the anchor line. Must resolve unambiguously. */
  match: string;
  /** Tour slug, or the literal `comment` for a non-navigable callout. */
  tour: string;
  /** Dot-aware order key. Required unless `tour` is `comment`. */
  order?: string | number;
  /** Step title (the rest of the header line). */
  title: string;
  /** Body paragraphs. A single string is treated as one paragraph. */
  body?: string | string[];
}

export interface InsertResult {
  ok: boolean;
  applied: number;
  skipped: number;
  problems: string[];
}

export interface InsertOptions {
  /** Resolve and report, but write nothing. */
  dryRun?: boolean;
  /** How far from `line` to search for `match`. */
  radius?: number;
}

const DEFAULT_RADIUS = 40;

/** Line-comment marker per language. `unknown` has no safe default. */
function markerFor(language: Language): string | null {
  switch (language) {
    case 'typescript':
    case 'tsx':
    case 'rust':
      return '//';
    case 'python':
      return '#';
    default:
      return null;
  }
}

/**
 * Apply a spec file. Nothing is written unless every entry resolves.
 */
export async function runInsert(
  root: string,
  specPath: string,
  options: InsertOptions = {},
): Promise<InsertResult> {
  const resolvedRoot = path.resolve(root);
  const radius = options.radius ?? DEFAULT_RADIUS;
  const entries = await readSpec(specPath);

  const problems: string[] = [];
  const byFile = new Map<string, InsertEntry[]>();
  for (const [i, entry] of entries.entries()) {
    const shapeError = validateShape(entry, i);
    if (shapeError) {
      problems.push(shapeError);
      continue;
    }
    const list = byFile.get(entry.file) ?? [];
    list.push(entry);
    byFile.set(entry.file, list);
  }

  // Phase 1: resolve everything. No file is touched in this pass.
  const plans: FilePlan[] = [];
  let skipped = 0;
  for (const [rel, fileEntries] of byFile) {
    const plan = await planFile(resolvedRoot, rel, fileEntries, radius, problems);
    if (plan) {
      skipped += plan.skipped.length;
      if (plan.insertions.length > 0) plans.push(plan);
    }
  }

  for (const plan of plans) {
    for (const note of plan.notes) console.log(`  ${note}`);
  }
  for (const plan of plans) {
    for (const s of plan.skipped) console.log(`  skip  ${s}`);
  }

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s); nothing was written:`);
    for (const p of problems) console.log(`  ${p}`);
    return { ok: false, applied: 0, skipped, problems };
  }

  // Phase 2: write. Insertions are applied bottom-up so earlier indices stay
  // valid as lines shift beneath them.
  let applied = 0;
  for (const plan of plans) {
    const lines = plan.lines.slice();
    for (const ins of [...plan.insertions].sort((a, b) => b.at - a.at)) {
      lines.splice(ins.at, 0, ...ins.block, '');
      applied++;
    }
    if (!options.dryRun) {
      const text = lines.join(plan.eol) + (plan.trailingNewline ? plan.eol : '');
      await fs.writeFile(path.join(resolvedRoot, plan.file), text, 'utf8');
    }
    console.log(`${plan.file}: ${plan.insertions.length} inserted`);
  }

  if (options.dryRun) console.log('\nDry run — no files were written.');
  console.log(
    `\n${applied} inserted, ${skipped} already present, ${entries.length} in spec.`,
  );
  return { ok: true, applied, skipped, problems: [] };
}

interface Insertion {
  /** 0-based index to splice at. */
  at: number;
  block: string[];
}

interface FilePlan {
  file: string;
  lines: string[];
  eol: string;
  trailingNewline: boolean;
  insertions: Insertion[];
  skipped: string[];
  notes: string[];
}

async function planFile(
  root: string,
  rel: string,
  entries: InsertEntry[],
  radius: number,
  problems: string[],
): Promise<FilePlan | null> {
  const abs = path.join(root, rel);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf8');
  } catch {
    problems.push(`${rel}: file not found`);
    return null;
  }

  const marker = markerFor(languageForPath(rel));
  if (marker === null) {
    problems.push(
      `${rel}: unsupported file type — no known comment syntax, refusing to guess`,
    );
    return null;
  }

  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = raw.endsWith('\n');
  const lines = raw.split(/\r?\n/);
  if (trailingNewline) lines.pop(); // split leaves a trailing empty entry

  const plan: FilePlan = {
    file: rel,
    lines,
    eol,
    trailingNewline,
    insertions: [],
    skipped: [],
    notes: [],
  };

  for (const entry of entries) {
    const header = renderHeader(entry);

    // Idempotency: if this exact header is already in the file, leave it alone.
    if (lines.some((l) => l.includes(header))) {
      plan.skipped.push(`${rel}  ${header} (already present)`);
      continue;
    }

    const found = findAnchor(lines, entry, radius);
    if ('error' in found) {
      problems.push(`${rel}${entry.line ? `:${entry.line}` : ''}  ${found.error}`);
      continue;
    }
    if (found.drift !== 0) {
      plan.notes.push(
        `drift  ${rel}:${entry.line} -> ${found.index + 1} (${found.drift > 0 ? '+' : ''}${found.drift})`,
      );
    }

    const anchorLine = lines[found.index];
    const indent = anchorLine.slice(0, anchorLine.length - anchorLine.trimStart().length);
    plan.insertions.push({
      at: hoist(lines, found.index),
      block: renderBlock(entry, indent, marker, header),
    });
  }

  return plan;
}

type AnchorHit = { index: number; drift: number } | { error: string };

/**
 * Locate the anchor line. A `line` hint is trusted only when `match` is
 * actually on it; otherwise we search a window around it and require exactly
 * one hit. Ambiguity is reported, never resolved by picking the closest.
 */
function findAnchor(lines: string[], entry: InsertEntry, radius: number): AnchorHit {
  const hint = entry.line !== undefined ? entry.line - 1 : null;

  if (hint !== null && hint >= 0 && hint < lines.length && lines[hint].includes(entry.match)) {
    return { index: hint, drift: 0 };
  }

  const from = hint === null ? 0 : Math.max(0, hint - radius);
  const to = hint === null ? lines.length - 1 : Math.min(lines.length - 1, hint + radius);
  const hits: number[] = [];
  for (let i = from; i <= to; i++) {
    if (lines[i].includes(entry.match)) hits.push(i);
  }

  if (hits.length === 1) {
    return { index: hits[0], drift: hint === null ? 0 : hits[0] - hint };
  }
  if (hits.length === 0) {
    return { error: `no line containing ${JSON.stringify(entry.match)}` };
  }
  return {
    error:
      `${hits.length} lines contain ${JSON.stringify(entry.match)} ` +
      `(lines ${hits.map((h) => h + 1).join(', ')}) — narrow the match`,
  };
}

/**
 * Walk up past contiguous comment lines so the inserted block starts its own
 * run. Consecutive `//`/`#` lines merge into one block and only the first line
 * is read as a header — and a Rust `#[derive(...)]` attribute counts as a `#`
 * comment to the scanner, so it must be cleared too. Decorators (`@…`) are
 * deliberately *not* hoisted over: they are code, so they never merge, and
 * staying below one keeps the following `def`/`class` as the resolved anchor.
 */
function hoist(lines: string[], index: number): number {
  let at = index;
  while (at > 0) {
    const prev = lines[at - 1].trim();
    if (
      prev.startsWith('//') ||
      prev.startsWith('#') ||
      prev.startsWith('*') ||
      prev.startsWith('/*')
    ) {
      at--;
    } else {
      break;
    }
  }
  return at;
}

function renderHeader(entry: InsertEntry): string {
  return entry.tour === 'comment'
    ? `@tour comment ${entry.title}`
    : `@tour ${entry.tour}:${entry.order} ${entry.title}`;
}

function renderBlock(
  entry: InsertEntry,
  indent: string,
  marker: string,
  header: string,
): string[] {
  const out = [`${indent}${marker} ${header}`];
  const paragraphs = normalizeBody(entry.body);
  for (const [i, para] of paragraphs.entries()) {
    // A bare marker line keeps paragraphs separate once the body is parsed as
    // Markdown; without it two paragraphs would render as one.
    if (i > 0) out.push(`${indent}${marker}`);
    for (const line of para.split('\n')) {
      out.push(`${indent}${marker} ${line}`.trimEnd());
    }
  }
  return out;
}

function normalizeBody(body: InsertEntry['body']): string[] {
  if (body === undefined) return [];
  const list = Array.isArray(body) ? body : [body];
  return list.map((p) => p.trim()).filter((p) => p.length > 0);
}

function validateShape(entry: InsertEntry, index: number): string | null {
  const at = `spec[${index}]`;
  if (typeof entry?.file !== 'string' || entry.file.length === 0) {
    return `${at}: missing "file"`;
  }
  if (typeof entry.match !== 'string' || entry.match.trim().length === 0) {
    return `${at} (${entry.file}): missing "match" — the text that anchors the comment`;
  }
  if (typeof entry.tour !== 'string' || entry.tour.length === 0) {
    return `${at} (${entry.file}): missing "tour"`;
  }
  if (typeof entry.title !== 'string' || entry.title.trim().length === 0) {
    return `${at} (${entry.file}): missing "title"`;
  }
  if (entry.line !== undefined && !Number.isInteger(entry.line)) {
    return `${at} (${entry.file}): "line" must be an integer`;
  }
  if (entry.tour !== 'comment') {
    if (entry.order === undefined) {
      return `${at} (${entry.file}): "order" is required for steps`;
    }
    if (!isValidOrderKey(String(entry.order))) {
      return `${at} (${entry.file}): invalid order key ${JSON.stringify(String(entry.order))}`;
    }
  }
  if (entry.file.includes('..')) {
    return `${at}: "file" must stay inside the project (${entry.file})`;
  }
  return null;
}

async function readSpec(specPath: string): Promise<InsertEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(path.resolve(specPath), 'utf8');
  } catch {
    throw new Error(`Cannot read spec file: ${specPath}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Spec is not valid JSON (${specPath}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Spec must be a JSON array of entries (${specPath}).`);
  }
  return parsed as InsertEntry[];
}
