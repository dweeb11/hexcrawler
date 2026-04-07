import { describe, expect, it } from "vitest";

import { cubeCoord } from "../../src/engine/hex";
import type { Relic, SearingState } from "../../src/engine/state";
import {
  FROST_PROXIMITY_THRESHOLDS,
  GEAR_RELIC_THRESHOLD,
  PILLARS_DISTANCE_THRESHOLD,
  checkPillarsOfFrost,
  checkRestartTheGear,
  frostProximityBand,
  frostProximityDistance,
} from "../../src/engine/win";

describe("frostProximityDistance", () => {
  it("returns distance ahead of the Searing for direction=1", () => {
    const searing: SearingState = { axis: "q", direction: 1, line: -10, advanceRate: 4 };
    expect(frostProximityDistance(cubeCoord(0, 0, 0), searing)).toBe(10);
    expect(frostProximityDistance(cubeCoord(5, -5, 0), searing)).toBe(15);
  });

  it("returns distance ahead of the Searing for direction=-1", () => {
    const searing: SearingState = { axis: "q", direction: -1, line: 10, advanceRate: 4 };
    expect(frostProximityDistance(cubeCoord(0, 0, 0), searing)).toBe(10);
    expect(frostProximityDistance(cubeCoord(-5, 5, 0), searing)).toBe(15);
  });
});

describe("frostProximityBand", () => {
  it("returns 0 below band 1 threshold", () => {
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[0] - 1)).toBe(0);
  });

  it("returns 1 at and above band 1 threshold", () => {
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[0])).toBe(1);
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[1] - 1)).toBe(1);
  });

  it("returns 2 at and above band 2 threshold", () => {
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[1])).toBe(2);
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[2] - 1)).toBe(2);
  });

  it("returns 3 at and above band 3 threshold", () => {
    expect(frostProximityBand(FROST_PROXIMITY_THRESHOLDS[2])).toBe(3);
    expect(frostProximityBand(PILLARS_DISTANCE_THRESHOLD - 1)).toBe(3);
  });
});

describe("checkPillarsOfFrost", () => {
  const searing: SearingState = { axis: "q", direction: 1, line: -10, advanceRate: 4 };

  it("returns false when player is below the threshold distance", () => {
    const playerQ = searing.line + PILLARS_DISTANCE_THRESHOLD - 1;
    expect(checkPillarsOfFrost(cubeCoord(playerQ, -playerQ, 0), searing)).toBe(false);
  });

  it("returns true when player reaches threshold distance", () => {
    const playerQ = searing.line + PILLARS_DISTANCE_THRESHOLD;
    expect(checkPillarsOfFrost(cubeCoord(playerQ, -playerQ, 0), searing)).toBe(true);
  });

  it("returns false for direction -1 when player is on the wrong side", () => {
    const reverseSearing: SearingState = { axis: "q", direction: -1, line: 10, advanceRate: 4 };
    expect(checkPillarsOfFrost(cubeCoord(11, -11, 0), reverseSearing)).toBe(false);
  });
});

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
