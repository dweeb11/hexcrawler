import { cubeCoord, hexDistance, type CubeCoord } from "./hex";
import { searingDistance } from "./searing";
import type { Relic, RNG, SearingState } from "./state";

export const PILLARS_MIN_DISTANCE = 12;
export const PILLARS_MAX_DISTANCE = 18;
export const SAFE_CORRIDOR_TOLERANCE = 2;
export const GEAR_RELIC_THRESHOLD = 4;

/** Max hex distance from Pillars for each frost band (1 = farthest hint, 3 = nearest). */
export const FROST_PROXIMITY_THRESHOLDS = [18, 15, 12] as const;

export function frostProximityBand(distanceToPillars: number): 0 | 1 | 2 | 3 {
  if (distanceToPillars <= FROST_PROXIMITY_THRESHOLDS[2]) return 3;
  if (distanceToPillars <= FROST_PROXIMITY_THRESHOLDS[1]) return 2;
  if (distanceToPillars <= FROST_PROXIMITY_THRESHOLDS[0]) return 1;
  return 0;
}

export function distanceToPillars(coord: CubeCoord, pillarsCoord: CubeCoord): number {
  return hexDistance(coord, pillarsCoord);
}

function corridorPerpendicularOffset(coord: CubeCoord, searing: SearingState): number {
  if (searing.axis === "q") {
    return Math.max(Math.abs(coord.r + coord.q), Math.abs(coord.s));
  }
  if (searing.axis === "r") {
    return Math.max(Math.abs(coord.q + coord.r), Math.abs(coord.s));
  }
  return Math.max(Math.abs(coord.q + coord.s), Math.abs(coord.r));
}

export function isInSafeCorridor(
  coord: CubeCoord,
  _pillarsCoord: CubeCoord,
  searing: SearingState,
): boolean {
  return corridorPerpendicularOffset(coord, searing) <= SAFE_CORRIDOR_TOLERANCE;
}

function coordAlongCorridor(
  playerStart: CubeCoord,
  searing: SearingState,
  alongDistance: number,
): CubeCoord {
  const safeSign = searing.direction;
  const distance = alongDistance * safeSign;

  if (searing.axis === "q") {
    return cubeCoord(playerStart.q + distance, playerStart.r - distance, playerStart.s);
  }
  if (searing.axis === "r") {
    return cubeCoord(playerStart.q, playerStart.r + distance, playerStart.s - distance);
  }
  return cubeCoord(playerStart.q - distance, playerStart.r, playerStart.s + distance);
}

export function placePillarsCoord(
  playerStart: CubeCoord,
  searing: SearingState,
  rng: RNG,
): CubeCoord {
  const span = PILLARS_MAX_DISTANCE - PILLARS_MIN_DISTANCE;
  const alongOffset = Math.floor(rng() * (span + 1));
  const alongDistance = PILLARS_MIN_DISTANCE + alongOffset;

  let candidate = coordAlongCorridor(playerStart, searing, alongDistance);

  if (
    hexDistance(playerStart, candidate) < PILLARS_MIN_DISTANCE ||
    searingDistance(candidate, searing) < PILLARS_MIN_DISTANCE
  ) {
    candidate = coordAlongCorridor(playerStart, searing, PILLARS_MAX_DISTANCE);
  }

  return candidate;
}

export function checkRestartTheGear(relics: Relic[]): boolean {
  return relics.length >= GEAR_RELIC_THRESHOLD;
}

export function isPillarsCoord(coord: CubeCoord, pillarsCoord: CubeCoord): boolean {
  return coord.q === pillarsCoord.q && coord.r === pillarsCoord.r && coord.s === pillarsCoord.s;
}
