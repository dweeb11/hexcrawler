import { cubeCoord, type CubeCoord } from "./hex";
import type { HexAxis, RNG, SearingState } from "./state";

export const SEARING_ADVANCE_RATE = 5;
export const SEARING_PROXIMITY_ZONE = 3;
export const SEARING_GRADIENT_GLYPHS = ["░", "▒", "▓", "█"] as const;

const AXES: HexAxis[] = ["q", "r", "s"];

export function initSearing(rng: RNG): SearingState {
  const axis = AXES[Math.floor(rng() * AXES.length)] ?? "q";
  const direction: 1 | -1 = rng() < 0.5 ? 1 : -1;

  return {
    axis,
    direction,
    line: direction === 1 ? -10 : 10,
    advanceRate: SEARING_ADVANCE_RATE,
  };
}

export function advanceSearing(searing: SearingState): SearingState {
  return {
    ...searing,
    line: searing.line + searing.direction,
  };
}

export function isConsumed(coord: CubeCoord, searing: SearingState): boolean {
  const axisValue = coord[searing.axis];
  return searing.direction === 1 ? axisValue <= searing.line : axisValue >= searing.line;
}

export function searingDistance(coord: CubeCoord, searing: SearingState): number {
  const axisValue = coord[searing.axis];
  return searing.direction === 1 ? axisValue - searing.line : searing.line - axisValue;
}

export function shouldAdvance(turn: number, advanceRate: number): boolean {
  return turn > 0 && turn % advanceRate === 0;
}

/** 0 = safe, 1 = fully consumed or on the advancing front. */
export function getSearingIntensity(coord: CubeCoord, searing: SearingState): number {
  const dist = searingDistance(coord, searing);
  if (dist <= 0) {
    return 1;
  }
  if (dist <= SEARING_PROXIMITY_ZONE) {
    return 1 - (dist / SEARING_PROXIMITY_ZONE) * 0.7;
  }
  return 0;
}

export function getSearingGlyph(intensity: number): string {
  if (intensity <= 0) {
    return "";
  }
  const index = Math.min(SEARING_GRADIENT_GLYPHS.length - 1, Math.floor(intensity * SEARING_GRADIENT_GLYPHS.length));
  return SEARING_GRADIENT_GLYPHS[index] ?? "█";
}

/** Cube step toward consumed territory (opposite the advance direction). */
export function getSearingTowardConsumedDelta(searing: SearingState): CubeCoord {
  const towardConsumed = searing.direction === 1 ? -1 : 1;
  switch (searing.axis) {
    case "q":
      return cubeCoord(towardConsumed, 0, -towardConsumed);
    case "r":
      return cubeCoord(0, towardConsumed, -towardConsumed);
    case "s":
      return cubeCoord(-towardConsumed, 0, towardConsumed);
    default: {
      const _exhaustive: never = searing.axis;
      return _exhaustive;
    }
  }
}
