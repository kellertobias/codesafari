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
  Doc,
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
  docs: Doc[];
  diagnostics: Diagnostic[];
}

const rel = (root: string, abs: string) =>
  path.relative(root, abs).split(path.sep).join('/');

// @tour pipeline:3.1 Loading authored content
// The authored half of the inputs. This reads `.tour/index.md`, every
// component, tour, and glossary file, validating frontmatter and collecting
// problems as diagnostics instead of throwing — so one bad file can't abort
// the whole build.
/** Load and validate all `.tour/` content under `root`. */
export async function loadContent(root: string): Promise<LoadedContent> {
  const tourDir = path.join(root, '.tour');
  const diagnostics: Diagnostic[] = [];

  const project = await loadProject(tourDir, root, diagnostics);
  const components = await loadComponents(tourDir, root, diagnostics);
  const tours = await loadTours(tourDir, root, diagnostics);
  const glossary = await loadGlossary(tourDir, root, diagnostics);
  const docs = await loadDocs(tourDir, root, diagnostics);

  return { project, components, tours, glossary, docs, diagnostics };
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

/**
 * Load the standalone documentation tree under `.tour/docs`.
 *
 * Unlike components and tours, docs carry no required frontmatter: the folder
 * layout supplies the slug and the navigation structure, and the title falls
 * back to the leading `# Heading` and then the file name. That keeps a doc a
 * plain Markdown file you can drop anywhere in the tree.
 */
async function loadDocs(
  tourDir: string,
  root: string,
  diagnostics: Diagnostic[],
): Promise<Doc[]> {
  const dir = path.join(tourDir, 'docs');
  const files = await collect(walk(dir, { filter: (p) => p.endsWith('.md') }));
  const docs: Doc[] = [];
  // Slug → the file that claimed it, so collisions name both sides.
  const claimed = new Map<string, string>();

  for (const file of files.sort()) {
    const sourcePath = rel(root, file);
    try {
      const { data, body } = parseFrontmatter(await fs.readFile(file, 'utf8'));
      const slug = docSlug(path.relative(dir, file));

      const prior = claimed.get(slug);
      if (prior) {
        diagnostics.push({
          severity: 'error',
          file: sourcePath,
          message: `Doc slug "${slug}" is already defined by ${prior}.`,
        });
        continue;
      }
      claimed.set(slug, sourcePath);

      const heading = splitLeadingHeading(body);
      docs.push({
        slug,
        title:
          optionalString(data, 'title') ??
          heading.title ??
          humanize(slug.split('/').pop() ?? slug),
        navTitle: optionalString(data, 'navTitle'),
        order: optionalNumber(data, 'order'),
        body: heading.body,
        sourcePath,
      });
    } catch (err) {
      diagnostics.push({
        severity: 'error',
        file: sourcePath,
        message: (err as Error).message,
      });
    }
  }

  return docs.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Derive a doc slug from its path relative to `.tour/docs`: drop the `.md`
 * extension, and let an `index.md` stand for its directory so a folder can have
 * its own landing page. The docs root `index.md` keeps the literal slug
 * `index`, since an empty slug isn't addressable.
 */
export function docSlug(relFile: string): string {
  const withoutExt = relFile
    .split(path.sep)
    .join('/')
    .replace(/\.md$/i, '');
  const collapsed = withoutExt.replace(/(^|\/)index$/i, '');
  return collapsed || 'index';
}

/**
 * Split off a leading `# Heading` so it can become the doc title without the
 * page rendering the same heading twice. Only a heading before any other
 * content counts; a `#` further down is part of the body.
 */
function splitLeadingHeading(body: string): { title?: string; body: string } {
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  const heading = /^#\s+(.+)$/.exec(lines[i] ?? '');
  if (!heading) return { body };
  return { title: heading[1].trim(), body: lines.slice(i + 1).join('\n').trim() };
}

/** Turn a `kebab-case` path segment into a readable fallback title. */
function humanize(segment: string): string {
  const words = segment.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
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
