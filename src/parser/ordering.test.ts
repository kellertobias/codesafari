import { describe, expect, it } from 'vitest';
import { compareOrder, isValidOrderKey, sortByOrder } from './ordering.js';

describe('dot-aware ordering', () => {
  it('validates order keys', () => {
    expect(isValidOrderKey('12')).toBe(true);
    expect(isValidOrderKey('12.34')).toBe(true);
    expect(isValidOrderKey('1.2.3')).toBe(true);
    expect(isValidOrderKey('12.')).toBe(false);
    expect(isValidOrderKey('a.b')).toBe(false);
    expect(isValidOrderKey('')).toBe(false);
  });

  it('sorts each dot segment numerically, not lexically', () => {
    expect(compareOrder('12.2', '12.10')).toBeLessThan(0);
    expect(compareOrder('12.34', '12.45')).toBeLessThan(0);
    expect(compareOrder('12.10', '12.2')).toBeGreaterThan(0);
    expect(compareOrder('12.2', '12.2')).toBe(0);
  });

  it('treats a shorter prefix as sorting before its extension', () => {
    expect(compareOrder('12', '12.1')).toBeLessThan(0);
    expect(compareOrder('12.1', '12')).toBeGreaterThan(0);
  });

  it('sorts a full list correctly', () => {
    const input = ['12.10', '1', '12.2', '2.1', '12', '2'];
    const sorted = sortByOrder(input, (x) => x);
    expect(sorted).toEqual(['1', '2', '2.1', '12', '12.2', '12.10']);
  });

  it('pushes invalid keys to the end without throwing', () => {
    const sorted = sortByOrder(['3', 'bad', '1'], (x) => x);
    expect(sorted).toEqual(['1', '3', 'bad']);
  });
});
