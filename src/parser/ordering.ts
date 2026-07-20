/**
 * Dot-aware ordering for tour step keys.
 *
 * Step orders like "12.34" are NOT decimal numbers: each dot-separated segment
 * is compared as an independent integer. So "12.2" sorts before "12.10", and
 * "12.34" sorts before "12.45". Keys may have any number of segments; a shorter
 * key sorts before a longer key that shares its prefix ("12" before "12.1").
 */

/** Returns true if `key` is a well-formed dot-aware order (e.g. "12", "12.34"). */
export function isValidOrderKey(key: string): boolean {
  return /^\d+(\.\d+)*$/.test(key);
}

function segments(key: string): number[] {
  return key.split('.').map((segment) => Number.parseInt(segment, 10));
}

/**
 * Compare two dot-aware order keys. Returns a negative number if `a` sorts
 * before `b`, positive if after, and 0 if equal. Invalid keys sort last, in
 * lexicographic order relative to one another, so a malformed key never crashes
 * a sort.
 */
// @tour comment Why compare segment-by-segment?
// Treating "12.10" as a decimal would sort it *before* "12.2", which is almost
// never what an author means. Comparing each dot-separated segment as its own
// integer lets you slot a step in between two others without renumbering.
export function compareOrder(a: string, b: string): number {
  const aValid = isValidOrderKey(a);
  const bValid = isValidOrderKey(b);
  if (!aValid || !bValid) {
    if (aValid) return -1;
    if (bValid) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  const as = segments(a);
  const bs = segments(b);
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    // A missing segment counts as -1 so "12" precedes "12.0" and "12.1".
    const av = i < as.length ? as[i] : -1;
    const bv = i < bs.length ? bs[i] : -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** Sort a copy of `items` by the dot-aware order key returned by `keyOf`. */
export function sortByOrder<T>(items: T[], keyOf: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareOrder(keyOf(a), keyOf(b)));
}
