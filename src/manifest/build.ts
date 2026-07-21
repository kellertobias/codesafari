/**
 * Assemble a {@link Manifest} from authored content and inline source comments.
 *
 * Pipeline:
 *   1. Load `.tour/` content (project, components, tours, glossary).
 *   2. Walk included source files and scan them for `@tour` comments.
 *   3. Resolve each step's highlight range and attach steps to their tours.
 *   4. Collect non-step callouts.
 *   5. Validate cross-references (tour slugs, component links, glossary links).
 *   6. Optionally bundle source-file content for offline export.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  Diagnostic,
  Manifest,
  SourceCallout,
  SourceFile,
  StepDetail,
  Tour,
  TourStep,
} from '../model/types.js';
import { MANIFEST_VERSION } from '../model/types.js';
import { IgnoreMatcher } from '../ignore/ignore.js';
import { collect, walk } from '../content/walk.js';
import { loadContent } from '../content/loadContent.js';
import { scanComments, type RawTourComment } from '../parser/comments.js';
import {
  languageForPath,
  resolveTarget,
  type Language,
} from '../parser/resolveTarget.js';
import { sortByOrder } from '../parser/ordering.js';

/** File extensions scanned for inline `@tour` comments in v1. */
const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.rs',
  '.py',
]);

export interface BuildOptions {
  /** When true, source-file content is bundled into the manifest (export). */
  bundleSources?: boolean;
}

export interface BuildResult {
  manifest: Manifest;
  diagnostics: Diagnostic[];
}

const rel = (root: string, abs: string) =>
  path.relative(root, abs).split(path.sep).join('/');

// @tour pipeline:3 Assembling the manifest
// The orchestrator. In order: load `.tour/` content, walk the non-ignored
// source files, scan each for `@tour` comments, resolve every step's highlight
// range, sort steps, validate cross-references, and (for export) bundle source.
// The next few steps zoom into the pieces this function calls.
export async function buildManifest(
  root: string,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const content = await loadContent(root);
  const diagnostics: Diagnostic[] = [...content.diagnostics];
  const ignore = await IgnoreMatcher.load(root);

  // 1. Seed one empty tour per authored tour file, keyed by slug.
  const tourBySlug = new Map<string, Tour>();
  for (const base of content.tours) {
    tourBySlug.set(base.slug, { ...base, steps: [] });
  }

  // 2–3. Scan source comments: attach steps to tours, collect callouts + details.
  const scan = await scanSources(
    root,
    ignore,
    tourBySlug,
    content.project.defaultSnippetLines,
    diagnostics,
  );

  // 4. Nest each detail under its enclosing step, sort/validate tours, then
  //    scope each callout to the step section it falls under.
  const tours = [...tourBySlug.values()];
  assignDetails(scan.pendingDetails, tours, diagnostics);
  finalizeTours(tours, diagnostics);
  scopeCallouts(scan.callouts, tours);

  // 5. Validate cross-references.
  validateReferences(content, tours, diagnostics);

  // 6. Bundle source content when exporting.
  const files = options.bundleSources
    ? await bundleSources(root, scan.allSourceFiles, diagnostics)
    : [];

  const manifest: Manifest = {
    version: MANIFEST_VERSION,
    project: content.project,
    components: content.components,
    tours,
    glossary: content.glossary,
    docs: content.docs,
    callouts: scan.callouts,
    examples: [],
    files,
    diagrams: [],
  };

  return { manifest, diagnostics };
}

interface ScanResult {
  callouts: SourceCallout[];
  /** `@tour:detail` sub-steps, assigned to their enclosing step after sorting. */
  pendingDetails: Array<{ file: string; detail: StepDetail }>;
  /** Every non-ignored source file, so the viewer's tree can browse them all. */
  allSourceFiles: Set<string>;
}

/**
 * Walk the non-ignored source files, scan each for `@tour` comments, and route
 * every comment: steps are resolved and pushed onto their tour, callouts and
 * details are collected for the caller to place.
 */
async function scanSources(
  root: string,
  ignore: IgnoreMatcher,
  tourBySlug: Map<string, Tour>,
  projectDefault: number,
  diagnostics: Diagnostic[],
): Promise<ScanResult> {
  const result: ScanResult = {
    callouts: [],
    pendingDetails: [],
    allSourceFiles: new Set<string>(),
  };

  const sourceFiles = await collect(
    walk(root, {
      ignore,
      filter: (p) => SOURCE_EXTENSIONS.has(path.extname(p)),
    }),
  );

  for (const abs of sourceFiles.sort()) {
    const relPath = rel(root, abs);
    result.allSourceFiles.add(relPath);

    const source = await readSource(abs, relPath, diagnostics);
    if (source === null) continue;

    const lines = source.split('\n');
    const language = languageForPath(relPath) as Language;

    for (const comment of scanComments(source)) {
      if (comment.kind === 'callout') {
        result.callouts.push({
          title: comment.title,
          body: comment.body,
          file: relPath,
          line: comment.startLine,
          sectionLine: null, // resolved by scopeCallouts once steps are known
        });
      } else if (comment.kind === 'detail') {
        result.pendingDetails.push({
          file: relPath,
          detail: toDetail(comment, lines, language, projectDefault),
        });
      } else {
        attachStep(comment, relPath, lines, language, projectDefault, tourBySlug, diagnostics);
      }
    }
  }

  return result;
}

/** Read a source file, recording a warning and returning null on failure. */
async function readSource(
  abs: string,
  relPath: string,
  diagnostics: Diagnostic[],
): Promise<string | null> {
  try {
    return await fs.readFile(abs, 'utf8');
  } catch (err) {
    diagnostics.push({
      severity: 'warning',
      file: relPath,
      message: `Cannot read source file: ${(err as Error).message}`,
    });
    return null;
  }
}

/** Build a detail sub-step from its comment, resolving the block it zooms to. */
function toDetail(
  comment: RawTourComment,
  lines: string[],
  language: Language,
  projectDefault: number,
): StepDetail {
  const resolved = resolveTarget(
    lines,
    comment.nextCodeLine,
    comment.startLine,
    projectDefault,
    language,
  );
  return {
    title: comment.title,
    body: comment.body,
    highlight: resolved.highlight,
    commentLine: comment.startLine,
    anchor: resolved.anchor,
  };
}

/** Resolve a step comment's highlight range and push it onto its tour. */
function attachStep(
  comment: RawTourComment,
  relPath: string,
  lines: string[],
  language: Language,
  projectDefault: number,
  tourBySlug: Map<string, Tour>,
  diagnostics: Diagnostic[],
): void {
  const tour = tourBySlug.get(comment.tourSlug!);
  if (!tour) {
    diagnostics.push({
      severity: 'error',
      file: relPath,
      line: comment.startLine,
      message: `Step references unknown tour "${comment.tourSlug}".`,
    });
    return;
  }

  const snippetLines = tour.defaultSnippetLines ?? projectDefault;
  const { highlight, anchor } = resolveTarget(
    lines,
    comment.nextCodeLine,
    comment.startLine,
    snippetLines,
    language,
  );

  tour.steps.push({
    tourSlug: tour.slug,
    order: comment.order!,
    title: comment.title,
    body: comment.body,
    file: relPath,
    highlight,
    commentLine: comment.startLine,
    anchor,
    details: [],
  });
}

/** Sort each tour's steps, warn on duplicate order keys, and flag empty tours. */
function finalizeTours(tours: Tour[], diagnostics: Diagnostic[]): void {
  for (const tour of tours) {
    tour.steps = sortByOrder(tour.steps, (s) => s.order);
    warnDuplicateOrders(tour, diagnostics);
    if (tour.steps.length === 0) {
      diagnostics.push({
        severity: 'warning',
        file: tour.sourcePath,
        message: `Tour "${tour.slug}" has no steps (no matching @tour comments).`,
      });
    }
  }
}

/**
 * Assign each callout to the step section it belongs to: the nearest step in the
 * same file whose comment precedes it. Callouts before every step in their file
 * keep `sectionLine: null` and so apply file-wide.
 */
function scopeCallouts(callouts: SourceCallout[], tours: Tour[]): void {
  const stepLinesByFile = new Map<string, number[]>();
  for (const tour of tours) {
    for (const step of tour.steps) {
      const lines = stepLinesByFile.get(step.file) ?? [];
      lines.push(step.commentLine);
      stepLinesByFile.set(step.file, lines);
    }
  }

  for (const callout of callouts) {
    const preceding = (stepLinesByFile.get(callout.file) ?? []).filter(
      (line) => line < callout.line,
    );
    callout.sectionLine = preceding.length > 0 ? Math.max(...preceding) : null;
  }
}

/** Warn once per step whose order key duplicates an earlier step in the tour. */
function warnDuplicateOrders(tour: Tour, diagnostics: Diagnostic[]): void {
  const seen = new Set<string>();
  for (const step of tour.steps) {
    if (seen.has(step.order)) {
      diagnostics.push({
        severity: 'warning',
        file: step.file,
        line: step.commentLine,
        message: `Duplicate step order "${step.order}" in tour "${tour.slug}".`,
      });
    }
    seen.add(step.order);
  }
}

/**
 * Attach each `@tour:detail` sub-step to the step whose highlight range encloses
 * it. When several steps in the same file enclose a detail (e.g. a class step
 * and a method step), the innermost — smallest — range wins. Orphan details
 * (inside no step) become warnings. Details are kept in file order.
 */
function assignDetails(
  pending: Array<{ file: string; detail: StepDetail }>,
  tours: Tour[],
  diagnostics: Diagnostic[],
): void {
  const stepsByFile = new Map<string, TourStep[]>();
  for (const tour of tours) {
    for (const step of tour.steps) {
      const list = stepsByFile.get(step.file) ?? [];
      list.push(step);
      stepsByFile.set(step.file, list);
    }
  }

  for (const { file, detail } of pending) {
    const candidates = (stepsByFile.get(file) ?? []).filter(
      (step) =>
        detail.commentLine >= step.highlight.start &&
        detail.commentLine <= step.highlight.end,
    );
    if (candidates.length === 0) {
      diagnostics.push({
        severity: 'warning',
        file,
        line: detail.commentLine,
        message: `@tour:detail "${detail.title}" is not inside any step's range; ignored.`,
      });
      continue;
    }
    // Innermost enclosing step: the smallest highlight span.
    const span = (s: TourStep) => s.highlight.end - s.highlight.start;
    const owner = candidates.reduce((a, b) => (span(b) < span(a) ? b : a));
    owner.details.push(detail);
  }

  for (const list of stepsByFile.values()) {
    for (const step of list) {
      step.details.sort((a, b) => a.commentLine - b.commentLine);
    }
  }
}

// @tour pipeline:4 Checking cross-references
// With steps attached, the builder verifies the graph holds together: tours
// reference real components, and every `glossary:<slug>` and `doc:<slug>` link
// across all Markdown bodies resolves to something defined. Broken links become
// warnings, which is exactly what `validate` surfaces.
function validateReferences(
  content: Awaited<ReturnType<typeof loadContent>>,
  tours: Tour[],
  diagnostics: Diagnostic[],
): void {
  const componentSlugs = new Set(content.components.map((c) => c.slug));
  const glossarySlugs = new Set(content.glossary.map((g) => g.slug));
  const docSlugs = new Set(content.docs.map((d) => d.slug));

  for (const tour of tours) {
    for (const comp of tour.components) {
      if (!componentSlugs.has(comp)) {
        diagnostics.push({
          severity: 'warning',
          file: tour.sourcePath,
          message: `Tour "${tour.slug}" references unknown component "${comp}".`,
        });
      }
    }
  }

  // Check `glossary:<slug>` and `doc:<slug>` links across all Markdown bodies.
  const bodies: Array<{ text: string; file: string }> = [
    { text: content.project.body, file: '.tour/index.md' },
    ...content.components.map((c) => ({ text: c.body, file: c.sourcePath })),
    ...content.glossary.map((g) => ({ text: g.body, file: g.sourcePath })),
    ...content.docs.map((d) => ({ text: d.body, file: d.sourcePath })),
    ...tours.flatMap((t) => [
      { text: t.body, file: t.sourcePath },
      ...t.steps.map((s) => ({ text: s.body, file: s.file })),
    ]),
  ];

  // Doc slugs are paths, so their character class allows `/`.
  const schemes = [
    { name: 'glossary', re: /\]\(glossary:([A-Za-z0-9._-]+)\)/g, known: glossarySlugs },
    { name: 'doc', re: /\]\(doc:([A-Za-z0-9._/-]+)\)/g, known: docSlugs },
  ];

  for (const { text, file } of bodies) {
    for (const { name, re, known } of schemes) {
      for (const match of text.matchAll(re)) {
        if (!known.has(match[1])) {
          diagnostics.push({
            severity: 'warning',
            file,
            message: `Broken ${name} link "${name}:${match[1]}".`,
          });
        }
      }
    }
  }
}

async function bundleSources(
  root: string,
  paths: Set<string>,
  diagnostics: Diagnostic[],
): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  for (const relPath of [...paths].sort()) {
    try {
      const content = await fs.readFile(path.join(root, relPath), 'utf8');
      files.push({ path: relPath, language: languageForPath(relPath), content });
    } catch (err) {
      diagnostics.push({
        severity: 'warning',
        file: relPath,
        message: `Cannot bundle source file: ${(err as Error).message}`,
      });
    }
  }
  return files;
}
