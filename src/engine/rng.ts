import type { RNG } from "./state";

/**
 * Park–Miller LCG (MINSTD). Normalizes non-positive seeds so sequences stay deterministic.
 */
export function createSeededRng(seed: number): RNG {
  let current = seed % 2147483647;
  if (current <= 0) {
    current += 2147483646;
  }

  return () => {
    current = (current * 16807) % 2147483647;
    return (current - 1) / 2147483646;
  };
}
