import type { Random } from './types';

/**
 * Deterministic Random from a 32-bit seed (mulberry32). Same seed, same
 * sequence: use it in tests, and anywhere a reproducible draw is wanted.
 */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
