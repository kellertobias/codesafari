import { describe, expect, it } from 'vitest';
import { scanComments } from './comments.js';

describe('scanComments', () => {
  it('parses a line-comment step block', () => {
    const src = [
      '// @tour onboarding:12.34 Enqueue a job',
      '// The producer pushes work onto the queue.',
      '// See [Queue worker](glossary:queue-worker).',
      'function enqueue() {}',
    ].join('\n');

    const [comment] = scanComments(src);
    expect(comment.kind).toBe('step');
    expect(comment.tourSlug).toBe('onboarding');
    expect(comment.order).toBe('12.34');
    expect(comment.title).toBe('Enqueue a job');
    expect(comment.body).toContain('producer pushes');
    expect(comment.body).toContain('glossary:queue-worker');
    expect(comment.startLine).toBe(1);
    expect(comment.nextCodeLine).toBe(4);
  });

  it('parses hash-style comments (Python)', () => {
    const src = ['# @tour setup:1 Bootstrap', '# Body text.', 'def go(): pass'].join(
      '\n',
    );
    const [comment] = scanComments(src);
    expect(comment.tourSlug).toBe('setup');
    expect(comment.order).toBe('1');
    expect(comment.body).toBe('Body text.');
  });

  it('parses a block comment', () => {
    const src = [
      '/*',
      ' * @tour api:2 Handler',
      ' * Handles the request.',
      ' */',
      'const handler = () => {};',
    ].join('\n');
    const [comment] = scanComments(src);
    expect(comment.tourSlug).toBe('api');
    expect(comment.title).toBe('Handler');
    expect(comment.body).toBe('Handles the request.');
    expect(comment.nextCodeLine).toBe(5);
  });

  it('recognizes non-step callouts', () => {
    const src = ['// @tour comment Watch out', '// Not thread-safe.'].join('\n');
    const [comment] = scanComments(src);
    expect(comment.kind).toBe('callout');
    expect(comment.title).toBe('Watch out');
    expect(comment.body).toBe('Not thread-safe.');
    expect(comment.tourSlug).toBeUndefined();
  });

  it('ignores comments without a @tour header', () => {
    const src = ['// just a normal comment', 'const x = 1;'].join('\n');
    expect(scanComments(src)).toHaveLength(0);
  });

  it('rejects a step with an invalid order key', () => {
    const src = ['// @tour onboarding:abc Bad', 'const x = 1;'].join('\n');
    expect(scanComments(src)).toHaveLength(0);
  });

  it('finds multiple comments in one file in order', () => {
    const src = [
      '// @tour t:1 First',
      'const a = 1;',
      '',
      '// @tour t:2 Second',
      'const b = 2;',
    ].join('\n');
    const comments = scanComments(src);
    expect(comments.map((c) => c.order)).toEqual(['1', '2']);
  });
});
