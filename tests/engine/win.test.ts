import { describe, expect, it } from "vitest";

import { cubeCoord } from "../../src/engine/hex";
import type { Relic, SearingState } from "../../src/engine/state";
import {
  FROST_PROXIMITY_THRESHOLDS,
  GEAR_RELIC_THRESHOLD,
  PILLARS_MAX_DISTANCE,
  PILLARS_MIN_DISTANCE,
  SAFE_CORRIDOR_TOLERANCE,
  checkRestartTheGear,
  distanceToPillars,
  frostProximityBand,
  isInSafeCorridor,
  placePillarsCoord,
} from "../../src/engine/win";

describe("frostProximityBand", () => {
  it("returns 0 when far from the Pillars", () => {
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[0] + 1)).toBe(0);
  });

  it("returns 1 within the outer frost band", () => {
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[0])).toBe(1);
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[1] + 1)).toBe(1);
  });

  it("returns 2 within the middle frost band", () => {
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[1])).toBe(2);
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[2] + 1)).toBe(2);
  });

  it("returns 3 when very close to the Pillars", () => {
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[2])).toBe(3);
    expect(frostProximityBand(0)).toBe(3);
  });
});

describe("placePillarsCoord", () => {
  const searing: SearingState = { axis: "q", direction: 1, line: -10, advanceRate: 4 };
  const start = cubeCoord(0, 0, 0);

  it("places within min/max corridor distance from start", () => {
    const pillars = placePillarsCoord(start, searing, () => 0);
    const along = distanceToPillars(start, pillars);
    expect(along).toBeGreaterThanOrEqual(PILLARS_MIN_DISTANCE);
    expect(along).toBeLessThanOrEqual(PILLARS_MAX_DISTANCE);
  });

  it("places on the safe corridor line", () => {
    const pillars = placePillarsCoord(start, searing, () => 0.99);
    expect(isInSafeCorridor(pillars, pillars, searing)).toBe(true);
    expect(pillars.r).toBe(-pillars.q);
    expect(pillars.s).toBe(0);
  });
});

describe("isInSafeCorridor", () => {
  const searing: SearingState = { axis: "q", direction: 1, line: -10, advanceRate: 4 };
  const pillars = cubeCoord(15, -15, 0);

  it("returns true on the ideal line", () => {
    expect(isInSafeCorridor(cubeCoord(10, -10, 0), pillars, searing)).toBe(true);
  });

  it("returns false when perpendicular offset exceeds tolerance", () => {
    expect(isInSafeCorridor(cubeCoord(10, -7, -3), pillars, searing)).toBe(false);
  });

  it("allows coords within corridor tolerance", () => {
    const nearLine = cubeCoord(10, -9, -1);
    expect(corridorOffset(nearLine, searing)).toBeLessThanOrEqual(SAFE_CORRIDOR_TOLERANCE);
    expect(isInSafeCorridor(nearLine, pillars, searing)).toBe(true);
  });
});

function corridorOffset(coord: ReturnType<typeof cubeCoord>, searing: SearingState): number {
  if (searing.axis === "q") {
    return Math.max(Math.abs(coord.r + coord.q), Math.abs(coord.s));
  }
  return 0;
}

describe("checkRestartTheGear", () => {
  const makeRelic = (id: string): Relic => ({
    id,
    name: id,
    description: id,
    effect: { type: "forage_bonus", bonus: 1 },
  });

  it("returns false when relic count is below threshold", () => {
    const relics = Array.from({ length: GEAR_RELIC_THRESHOLD - 1 }, (_, i) => makeRelic(`r${i}`));
    expect(checkRestartTheGear(relics)).toBe(false);
  });

  it("returns true when relic count reaches threshold", () => {
    const relics = Array.from({ length: GEAR_RELIC_THRESHOLD }, (_, i) => makeRelic(`r${i}`));
    expect(checkRestartTheGear(relics)).toBe(true);
  });
});
