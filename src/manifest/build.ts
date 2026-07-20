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
  Tour,
  TourStep,
} from '../model/types.js';
import { MANIFEST_VERSION } from '../model/types.js';
import { IgnoreMatcher } from '../ignore/ignore.js';
import { collect, walk } from '../content/walk.js';
import { loadContent } from '../content/loadContent.js';
import { scanComments } from '../parser/comments.js';
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

  const tourBySlug = new Map<string, Tour>();
  for (const base of content.tours) {
    tourBySlug.set(base.slug, { ...base, steps: [] });
  }

  const callouts: SourceCallout[] = [];
  /** Every non-ignored source file, so the viewer's tree can browse them all. */
  const allSourceFiles = new Set<string>();
  const projectDefault = content.project.defaultSnippetLines;

  // 2–4. Scan source files for comments and resolve targets.
  const sourceFiles = await collect(
    walk(root, {
      ignore,
      filter: (p) => SOURCE_EXTENSIONS.has(path.extname(p)),
    }),
  );

  for (const abs of sourceFiles.sort()) {
    const relPath = rel(root, abs);
    allSourceFiles.add(relPath);
    let source: string;
    try {
      source = await fs.readFile(abs, 'utf8');
    } catch (err) {
      diagnostics.push({
        severity: 'warning',
        file: relPath,
        message: `Cannot read source file: ${(err as Error).message}`,
      });
      continue;
    }

    const lines = source.split('\n');
    const language: Language = languageForPath(relPath) as Language;
    const comments = scanComments(source);

    for (const comment of comments) {
      if (comment.kind === 'callout') {
        callouts.push({
          title: comment.title,
          body: comment.body,
          file: relPath,
          line: comment.startLine,
        });
        continue;
      }

      const tour = tourBySlug.get(comment.tourSlug!);
      if (!tour) {
        diagnostics.push({
          severity: 'error',
          file: relPath,
          line: comment.startLine,
          message: `Step references unknown tour "${comment.tourSlug}".`,
        });
        continue;
      }

      const snippetLines = tour.defaultSnippetLines ?? projectDefault;
      const { highlight, anchor } = resolveTarget(
        lines,
        comment.nextCodeLine,
        comment.startLine,
        snippetLines,
        language,
      );

      const step: TourStep = {
        tourSlug: tour.slug,
        order: comment.order!,
        title: comment.title,
        body: comment.body,
        file: relPath,
        highlight,
        commentLine: comment.startLine,
        anchor,
      };
      tour.steps.push(step);
    }
  }

  // Sort steps and detect duplicate order keys within a tour.
  for (const tour of tourBySlug.values()) {
    tour.steps = sortByOrder(tour.steps, (s) => s.order);
    const seen = new Map<string, TourStep>();
    for (const step of tour.steps) {
      if (seen.has(step.order)) {
        diagnostics.push({
          severity: 'warning',
          file: step.file,
          line: step.commentLine,
          message: `Duplicate step order "${step.order}" in tour "${tour.slug}".`,
        });
      }
      seen.set(step.order, step);
    }
    if (tour.steps.length === 0) {
      diagnostics.push({
        severity: 'warning',
        file: tour.sourcePath,
        message: `Tour "${tour.slug}" has no steps (no matching @tour comments).`,
      });
    }
  }

  const tours = [...tourBySlug.values()];

  // 5. Validate cross-references.
  validateReferences(content, tours, diagnostics);

  // 6. Bundle source content when exporting.
  let files: SourceFile[] = [];
  if (options.bundleSources) {
    files = await bundleSources(root, allSourceFiles, diagnostics);
  }

  const manifest: Manifest = {
    version: MANIFEST_VERSION,
    project: content.project,
    components: content.components,
    tours,
    glossary: content.glossary,
    callouts,
    examples: [],
    files,
    diagrams: [],
  };

  return { manifest, diagnostics };
}

// @tour pipeline:4 Checking cross-references
// With steps attached, the builder verifies the graph holds together: tours
// reference real components, and every `glossary:<slug>` link across all
// Markdown bodies resolves to a defined concept. Broken links become warnings,
// which is exactly what `validate` surfaces.
function validateReferences(
  content: Awaited<ReturnType<typeof loadContent>>,
  tours: Tour[],
  diagnostics: Diagnostic[],
): void {
  const componentSlugs = new Set(content.components.map((c) => c.slug));
  const glossarySlugs = new Set(content.glossary.map((g) => g.slug));

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

  // Check `glossary:<slug>` links across all Markdown bodies.
  const bodies: Array<{ text: string; file: string }> = [
    { text: content.project.body, file: '.tour/index.md' },
    ...content.components.map((c) => ({ text: c.body, file: c.sourcePath })),
    ...content.glossary.map((g) => ({ text: g.body, file: g.sourcePath })),
    ...tours.flatMap((t) => [
      { text: t.body, file: t.sourcePath },
      ...t.steps.map((s) => ({ text: s.body, file: s.file })),
    ]),
  ];

  const linkRe = /\]\(glossary:([A-Za-z0-9._-]+)\)/g;
  for (const { text, file } of bodies) {
    for (const match of text.matchAll(linkRe)) {
      if (!glossarySlugs.has(match[1])) {
        diagnostics.push({
          severity: 'warning',
          file,
          message: `Broken glossary link "glossary:${match[1]}".`,
        });
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
