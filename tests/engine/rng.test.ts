import { describe, expect, it } from "vitest";

import { createRng } from "../../src/engine/rng";

describe("createRng", () => {
  it("produces a deterministic sequence for a fixed seed", () => {
    const rngA = createRng(42);
    const rngB = createRng(42);

    const sequenceA = Array.from({ length: 5 }, () => rngA());
    const sequenceB = Array.from({ length: 5 }, () => rngB());

    expect(sequenceA).toEqual(sequenceB);
    expect(sequenceA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("normalizes non-positive seeds", () => {
    const rng = createRng(0);
    expect(rng()).toBeGreaterThanOrEqual(0);
    expect(rng()).toBeLessThan(1);
  });
});
