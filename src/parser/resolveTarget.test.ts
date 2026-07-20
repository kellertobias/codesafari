import { describe, expect, it } from 'vitest';
import { languageForPath, resolveTarget } from './resolveTarget.js';

describe('resolveTarget', () => {
  it('highlights a whole class in a C-like language', () => {
    const lines = [
      '// @tour t:1 The worker',
      'class Worker {',
      '  run() {',
      '    return 42;',
      '  }',
      '}',
      'const x = 1;',
    ];
    const result = resolveTarget(lines, 2, 1, 10, 'typescript');
    expect(result.anchor).toBe('class');
    expect(result.highlight).toEqual({ start: 2, end: 6 });
  });

  it('highlights a function in a C-like language', () => {
    const lines = ['// c', 'function drain() {', '  return;', '}', 'x;'];
    const result = resolveTarget(lines, 2, 1, 10, 'typescript');
    expect(result.anchor).toBe('function');
    expect(result.highlight).toEqual({ start: 2, end: 4 });
  });

  it('highlights a whole function with a destructured-props signature', () => {
    const lines = [
      '// @tour t:1 Local state',
      'export function Counter({ start = 0 }: CounterProps) {',
      '  const [count, setCount] = useState(start);',
      '  return count;',
      '}',
      'const x = 1;',
    ];
    const result = resolveTarget(lines, 2, 1, 10, 'tsx');
    expect(result.anchor).toBe('function');
    expect(result.highlight).toEqual({ start: 2, end: 5 });
  });

  it('highlights a Python function by indentation', () => {
    const lines = [
      '# comment',
      'def setup():',
      '    value = 1',
      '    return value',
      '',
      'other = 2',
    ];
    const result = resolveTarget(lines, 2, 1, 10, 'python');
    expect(result.anchor).toBe('function');
    expect(result.highlight).toEqual({ start: 2, end: 4 });
  });

  it('falls back to a snippet when no block follows', () => {
    const lines = ['// comment', 'const a = 1;', 'const b = 2;', 'const c = 3;'];
    const result = resolveTarget(lines, 2, 1, 2, 'typescript');
    expect(result.anchor).toBe('snippet');
    expect(result.highlight).toEqual({ start: 1, end: 3 });
  });

  it('falls back to a snippet at end of file', () => {
    const lines = ['// comment', '// more'];
    const result = resolveTarget(lines, null, 1, 5, 'typescript');
    expect(result.anchor).toBe('snippet');
    expect(result.highlight.start).toBe(1);
  });
});

describe('languageForPath', () => {
  it('maps extensions to languages', () => {
    expect(languageForPath('a/b.ts')).toBe('typescript');
    expect(languageForPath('a.tsx')).toBe('tsx');
    expect(languageForPath('a.rs')).toBe('rust');
    expect(languageForPath('a.py')).toBe('python');
    expect(languageForPath('a.txt')).toBe('unknown');
  });
});
