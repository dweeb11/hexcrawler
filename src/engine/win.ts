import type { CubeCoord } from "./hex";
import type { Relic, SearingState } from "./state";

export const PILLARS_DISTANCE_THRESHOLD = 18;
export const GEAR_RELIC_THRESHOLD = 4;

// Proximity band thresholds: distance ahead of the Searing at which each band fires.
// Player starts ~10 units ahead; win requires 20. Bands fire at 12, 15, 18.
export const FROST_PROXIMITY_THRESHOLDS = [12, 15, 18] as const;

export function frostProximityDistance(playerHex: CubeCoord, searing: SearingState): number {
  const playerAxisValue = playerHex[searing.axis];
  return searing.direction === 1
    ? playerAxisValue - searing.line
    : searing.line - playerAxisValue;
}

export function frostProximityBand(distance: number): 0 | 1 | 2 | 3 {
  if (distance >= FROST_PROXIMITY_THRESHOLDS[2]) return 3;
  if (distance >= FROST_PROXIMITY_THRESHOLDS[1]) return 2;
  if (distance >= FROST_PROXIMITY_THRESHOLDS[0]) return 1;
  return 0;
}

export function checkPillarsOfFrost(playerHex: CubeCoord, searing: SearingState): boolean {
  return frostProximityDistance(playerHex, searing) >= PILLARS_DISTANCE_THRESHOLD;
}

export function checkRestartTheGear(relics: Relic[]): boolean {
  return relics.length >= GEAR_RELIC_THRESHOLD;
}
