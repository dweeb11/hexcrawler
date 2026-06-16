import { describe, expect, it } from "vitest";

import { cubeCoord } from "../../src/engine/hex";
import {
  advanceSearing,
  initSearing,
  isConsumed,
  searingDistance,
  SEARING_ADVANCE_RATE,
} from "../../src/engine/searing";
import { createInitialState, type SearingState } from "../../src/engine/state";

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

describe("searingDistance", () => {
  it("measures how far ahead of the line a coord sits, both directions", () => {
    const forward: SearingState = { axis: "q", direction: 1, line: -10, advanceRate: 4 };
    expect(searingDistance(cubeCoord(0, 0, 0), forward)).toBe(10);
    expect(searingDistance(cubeCoord(5, -5, 0), forward)).toBe(15);

    const backward: SearingState = { axis: "q", direction: -1, line: 10, advanceRate: 4 };
    expect(searingDistance(cubeCoord(0, 0, 0), backward)).toBe(10);
    expect(searingDistance(cubeCoord(-5, 5, 0), backward)).toBe(15);
  });
});

describe("initSearing", () => {
  it("produces a line offset 10 units behind the start, opposite the advance direction", () => {
    const forward = initSearing(() => 0);
    expect(forward.direction).toBe(1);
    expect(forward.line).toBe(-10);
    expect(forward.advanceRate).toBe(SEARING_ADVANCE_RATE);

    const backward = initSearing(() => 0.99);
    expect(backward.direction).toBe(-1);
    expect(backward.line).toBe(10);
  });

  it("is the single source createInitialState uses for its searing field", () => {
    const seed = () => 0.42;
    const expected = initSearing(seed);
    const state = createInitialState([], () => 0.42);
    expect(state.searing).toEqual(expected);
  });
});
