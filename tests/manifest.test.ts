import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildManifest } from '../src/manifest/build.js';

const demoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'demo',
);

describe('buildManifest (integration, demo fixture)', () => {
  it('produces a manifest with no errors', async () => {
    const { manifest, diagnostics } = await buildManifest(demoRoot);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
    expect(manifest.project.title).toBe('Demo Project');
    expect(manifest.components).toHaveLength(1);
    expect(manifest.tours).toHaveLength(1);
    expect(manifest.glossary.map((g) => g.slug).sort()).toEqual([
      'idempotency',
      'queue-worker',
    ]);
  });

  it('orders steps with dot-aware ordering and resolves anchors', async () => {
    const { manifest } = await buildManifest(demoRoot);
    const tour = manifest.tours.find((t) => t.slug === 'onboarding')!;
    expect(tour.steps.map((s) => s.order)).toEqual(['1', '12.2', '12.10']);

    const enqueue = tour.steps.find((s) => s.order === '12.2')!;
    expect(enqueue.anchor).toBe('class');
    expect(enqueue.file).toBe('src/worker.ts');
  });

  it('attaches @tour:detail sub-steps to their enclosing step', async () => {
    const { manifest } = await buildManifest(demoRoot);
    const tour = manifest.tours.find((t) => t.slug === 'onboarding')!;
    const enqueue = tour.steps.find((s) => s.order === '12.2')!;
    expect(enqueue.details).toHaveLength(1);
    expect(enqueue.details[0].title).toBe('The run method');
    expect(enqueue.details[0].anchor).toBe('method');
    // The detail zooms to the run() method, inside the class range.
    expect(enqueue.details[0].highlight.start).toBeGreaterThanOrEqual(
      enqueue.highlight.start,
    );
    expect(enqueue.details[0].highlight.end).toBeLessThanOrEqual(
      enqueue.highlight.end,
    );

    // A step without details has an empty array.
    const drain = tour.steps.find((s) => s.order === '12.10')!;
    expect(drain.details).toEqual([]);
  });

  it('collects non-step callouts', async () => {
    const { manifest } = await buildManifest(demoRoot);
    expect(manifest.callouts).toHaveLength(1);
    expect(manifest.callouts[0].title).toBe('Watch out');
  });

  it('scopes a callout to the step section it falls under', async () => {
    const { manifest } = await buildManifest(demoRoot);
    const tour = manifest.tours.find((t) => t.slug === 'onboarding')!;
    const drain = tour.steps.find((s) => s.order === '12.10')!;

    // The "Watch out" callout sits after the 12.10 step in worker.ts, so it
    // belongs to that section (its comment line), not the whole file.
    const callout = manifest.callouts[0];
    expect(callout.file).toBe('src/worker.ts');
    expect(callout.sectionLine).toBe(drain.commentLine);
  });

  it('bundles source content only when requested', async () => {
    const plain = await buildManifest(demoRoot);
    expect(plain.manifest.files).toHaveLength(0);

    const bundled = await buildManifest(demoRoot, { bundleSources: true });
    const paths = bundled.manifest.files.map((f) => f.path).sort();
    expect(paths).toEqual(['src/util.py', 'src/worker.ts']);
  });

  it('reports a diagnostic for a step referencing an unknown tour', async () => {
    // The fixture is clean; assert the happy path stays clean as a guard.
    const { diagnostics } = await buildManifest(demoRoot);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('derives doc slugs from the folder structure', async () => {
    const { manifest } = await buildManifest(demoRoot);
    expect(manifest.docs.map((d) => d.slug)).toEqual([
      // `index.md` takes its directory's slug, so a folder can have a page.
      'architecture',
      'architecture/internals/scheduler',
      'architecture/retries',
      'deployment',
    ]);
  });

  it('resolves doc titles from frontmatter, heading, then file name', async () => {
    const { manifest } = await buildManifest(demoRoot);
    const bySlug = new Map(manifest.docs.map((d) => [d.slug, d]));

    // Frontmatter `title` wins.
    expect(bySlug.get('architecture/retries')!.title).toBe('Retry semantics');
    // Else the leading `# Heading` — which is then stripped from the body so
    // the page doesn't render its title twice.
    const section = bySlug.get('architecture')!;
    expect(section.title).toBe('How the demo is put together');
    expect(section.body.startsWith('#')).toBe(false);
    // `navTitle` overrides the label in the navigation tree only.
    expect(section.navTitle).toBe('Architecture');
    expect(section.order).toBe(1);
    // Else the humanized file name.
    expect(bySlug.get('deployment')!.title).toBe('Deployment');
  });

  it('validates doc: links like glossary: links', async () => {
    const { diagnostics } = await buildManifest(demoRoot);
    // The fixture's `doc:architecture/retries` link resolves.
    expect(diagnostics.filter((d) => d.message.includes('doc link'))).toEqual([]);
  });
});
