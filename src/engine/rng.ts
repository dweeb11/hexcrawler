import type { RNG } from "./state";

/** Park–Miller minimal standard LCG; deterministic for a fixed seed. */
export function createRng(seed: number): RNG {
  let current = seed % 2147483647;
  if (current <= 0) {
    current += 2147483646;
  }

  return () => {
    current = (current * 16807) % 2147483647;
    return (current - 1) / 2147483646;
  };
}
