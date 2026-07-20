/**
 * Load authored `.tour/` content into typed model objects.
 *
 * This layer is responsible only for reading and validating Markdown +
 * frontmatter — it does not scan source comments or resolve highlight ranges.
 * Problems are collected as {@link Diagnostic}s rather than thrown, so a single
 * bad file doesn't abort the whole build; only fatal I/O errors propagate.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  Component,
  Diagnostic,
  GlossaryConcept,
  ProjectMeta,
  Tour,
} from '../model/types.js';
import { collect, walk } from './walk.js';
import {
  FieldError,
  optionalNumber,
  optionalString,
  optionalStringArray,
  parseFrontmatter,
  requireString,
} from './frontmatter.js';

const DEFAULT_SNIPPET_LINES = 20;

export interface LoadedContent {
  project: ProjectMeta;
  components: Component[];
  tours: Omit<Tour, 'steps'>[];
  glossary: GlossaryConcept[];
  diagnostics: Diagnostic[];
}

const rel = (root: string, abs: string) =>
  path.relative(root, abs).split(path.sep).join('/');

/** Load and validate all `.tour/` content under `root`. */
export async function loadContent(root: string): Promise<LoadedContent> {
  const tourDir = path.join(root, '.tour');
  const diagnostics: Diagnostic[] = [];

  const project = await loadProject(tourDir, root, diagnostics);
  const components = await loadComponents(tourDir, root, diagnostics);
  const tours = await loadTours(tourDir, root, diagnostics);
  const glossary = await loadGlossary(tourDir, root, diagnostics);

  return { project, components, tours, glossary, diagnostics };
}

async function loadProject(
  tourDir: string,
  root: string,
  diagnostics: Diagnostic[],
): Promise<ProjectMeta> {
  const file = path.join(tourDir, 'index.md');
  try {
    const raw = await fs.readFile(file, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    return {
      title: requireString(data, 'title', '.tour/index.md'),
      description: optionalString(data, 'description') ?? '',
      defaultSnippetLines:
        optionalNumber(data, 'defaultSnippetLines') ?? DEFAULT_SNIPPET_LINES,
      repositoryUrl: optionalString(data, 'repositoryUrl'),
      body,
    };
  } catch (err) {
    diagnostics.push({
      severity: 'error',
      file: rel(root, file),
      message:
        err instanceof FieldError
          ? err.message
          : `Cannot read .tour/index.md: ${(err as Error).message}`,
    });
    return {
      title: 'Untitled project',
      description: '',
      defaultSnippetLines: DEFAULT_SNIPPET_LINES,
      body: '',
    };
  }
}

async function loadComponents(
  tourDir: string,
  root: string,
  diagnostics: Diagnostic[],
): Promise<Component[]> {
  const dir = path.join(tourDir, 'components');
  const files = await collect(walk(dir, { filter: (p) => p.endsWith('.md') }));
  const components: Component[] = [];

  for (const file of files.sort()) {
    try {
      const { data, body } = parseFrontmatter(await fs.readFile(file, 'utf8'));
      components.push({
        slug: requireString(data, 'slug', rel(root, file)),
        title: requireString(data, 'title', rel(root, file)),
        summary: optionalString(data, 'summary'),
        order: optionalNumber(data, 'order'),
        body,
        sourcePath: rel(root, file),
      });
    } catch (err) {
      diagnostics.push({
        severity: 'error',
        file: rel(root, file),
        message: (err as Error).message,
      });
    }
  }

  return sortByOrderThenTitle(components);
}

async function loadTours(
  tourDir: string,
  root: string,
  diagnostics: Diagnostic[],
): Promise<Omit<Tour, 'steps'>[]> {
  const dir = path.join(tourDir, 'tours');
  const files = await collect(walk(dir, { filter: (p) => p.endsWith('.md') }));
  const tours: Omit<Tour, 'steps'>[] = [];

  for (const file of files.sort()) {
    try {
      const { data, body } = parseFrontmatter(await fs.readFile(file, 'utf8'));
      tours.push({
        slug: requireString(data, 'slug', rel(root, file)),
        title: requireString(data, 'title', rel(root, file)),
        components: optionalStringArray(data, 'components'),
        order: optionalNumber(data, 'order'),
        defaultSnippetLines: optionalNumber(data, 'defaultSnippetLines'),
        body,
        sourcePath: rel(root, file),
      });
    } catch (err) {
      diagnostics.push({
        severity: 'error',
        file: rel(root, file),
        message: (err as Error).message,
      });
    }
  }

  return sortByOrderThenTitle(tours);
}

/**
 * Glossary files may define multiple concepts via level-2 headings. A file with
 * frontmatter `slug`/`title` and no headings is treated as a single concept.
 */
async function loadGlossary(
  tourDir: string,
  root: string,
  diagnostics: Diagnostic[],
): Promise<GlossaryConcept[]> {
  const dir = path.join(tourDir, 'glossary');
  const files = await collect(walk(dir, { filter: (p) => p.endsWith('.md') }));
  const concepts: GlossaryConcept[] = [];

  for (const file of files.sort()) {
    try {
      const { body } = parseFrontmatter(await fs.readFile(file, 'utf8'));
      const parsed = splitConcepts(body, rel(root, file));
      if (parsed.length === 0) {
        diagnostics.push({
          severity: 'warning',
          file: rel(root, file),
          message: 'Glossary file defines no concepts (no `## Heading` found).',
        });
      }
      concepts.push(...parsed);
    } catch (err) {
      diagnostics.push({
        severity: 'error',
        file: rel(root, file),
        message: (err as Error).message,
      });
    }
  }

  return concepts;
}

/** Split a glossary Markdown body into concepts keyed by `## Heading`. */
function splitConcepts(body: string, sourcePath: string): GlossaryConcept[] {
  const lines = body.split('\n');
  const concepts: GlossaryConcept[] = [];
  let current: { title: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    concepts.push({
      slug: slugify(current.title),
      title: current.title,
      body: current.lines.join('\n').trim(),
      sourcePath,
    });
  };

  for (const line of lines) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      current = { title: heading[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();

  return concepts;
}

/** Convert a heading title into a URL-safe glossary slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sortByOrderThenTitle<T extends { order?: number; title: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.title.localeCompare(b.title);
  });
}
