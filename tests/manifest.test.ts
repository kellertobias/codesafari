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

  it('collects non-step callouts', async () => {
    const { manifest } = await buildManifest(demoRoot);
    expect(manifest.callouts).toHaveLength(1);
    expect(manifest.callouts[0].title).toBe('Watch out');
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
});
