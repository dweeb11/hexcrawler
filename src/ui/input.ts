import { coordKey, HEX_DIRECTIONS, type CubeCoord, type HexDirection } from "../engine/hex";
import type { Action, GameMode } from "../engine/state";

// Matches flat-top hexToPixel: W/S pure N/S; Q/E/A/D diagonals (see legend in renderer/legend.ts).
const KEY_TO_DIRECTION: Record<string, HexDirection> = {
  q: 3,
  w: 2,
  e: 1,
  a: 4,
  s: 5,
  d: 0,
};

export function keyToAction(key: string, mode: GameMode): Action | null {
  const normalized = key.toLowerCase();

  if (mode.type === "map") {
    if (normalized in KEY_TO_DIRECTION) {
      return { type: "push", direction: KEY_TO_DIRECTION[normalized] };
    }
    if (normalized === "r") {
      return { type: "pause", activity: "rest" };
    }
    if (normalized === "f") {
      return { type: "pause", activity: "forage" };
    }
    return null;
  }

  if (mode.type === "encounter") {
    const choiceIndex = Number.parseInt(normalized, 10) - 1;
    if (!Number.isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < mode.encounter.choices.length) {
      return { type: "choose", choiceIndex };
    }
    return null;
  }

  if (mode.type === "camp") {
    return { type: "dismiss" };
  }

  return null;
}

export function clickedNeighborToAction(center: CubeCoord, clicked: CubeCoord): Action | null {
  const targetKey = coordKey(clicked);
  const direction = HEX_DIRECTIONS.findIndex((delta) =>
    coordKey({
      q: center.q + delta.q,
      r: center.r + delta.r,
      s: center.s + delta.s,
    }) === targetKey,
  );

  if (direction === -1) {
    return null;
  }

  return { type: "push", direction: direction as HexDirection };
}
