import { describe, expect, it } from "vitest";

import { cubeCoord } from "../../src/engine/hex";
import { advanceSearing, isConsumed } from "../../src/engine/searing";
import type { SearingState } from "../../src/engine/state";

describe("advanceSearing", () => {
  it("moves the line one step in the configured direction", () => {
    const forward: SearingState = { axis: "q", direction: 1, line: -5, advanceRate: 4 };
    const backward: SearingState = { axis: "r", direction: -1, line: 5, advanceRate: 4 };

    expect(advanceSearing(forward).line).toBe(-4);
    expect(advanceSearing(backward).line).toBe(4);
  });
});

describe("isConsumed", () => {
  it("checks hexes against the moving threshold", () => {
    expect(isConsumed(cubeCoord(0, 0, 0), { axis: "q", direction: 1, line: -3, advanceRate: 4 })).toBe(
      false,
    );
    expect(isConsumed(cubeCoord(1, 0, -1), { axis: "q", direction: 1, line: 2, advanceRate: 4 })).toBe(
      true,
    );
    expect(isConsumed(cubeCoord(2, -1, -1), { axis: "q", direction: -1, line: 0, advanceRate: 4 })).toBe(
      true,
    );
    expect(isConsumed(cubeCoord(2, -1, -1), { axis: "q", direction: -1, line: 3, advanceRate: 4 })).toBe(
      false,
    );
  });
});
