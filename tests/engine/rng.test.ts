import { describe, expect, it } from "vitest";

import { createSeededRng } from "../../src/engine/rng";

describe("createSeededRng", () => {
  it("produces a deterministic sequence for a fixed seed", () => {
    const rngA = createSeededRng(42);
    const rngB = createSeededRng(42);

    const sequenceA = Array.from({ length: 5 }, () => rngA());
    const sequenceB = Array.from({ length: 5 }, () => rngB());

    expect(sequenceA).toEqual(sequenceB);
    expect(sequenceA[0]).toBeCloseTo(0.0003287070433876543);
  });

  it("normalizes non-positive seeds to valid starting states", () => {
    const rngZero = createSeededRng(0);
    const rngZeroAgain = createSeededRng(0);

    expect(rngZero()).toBe(rngZeroAgain());
  });

  it("returns values in [0, 1)", () => {
    const rng = createSeededRng(12345);

    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
