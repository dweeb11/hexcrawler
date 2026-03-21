import type { CubeCoord } from "./hex";
import type { HexAxis, RNG, SearingState } from "./state";
import { SEARING_ADVANCE_RATE } from "./state";

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

export function shouldAdvance(turn: number, advanceRate: number): boolean {
  return turn > 0 && turn % advanceRate === 0;
}
