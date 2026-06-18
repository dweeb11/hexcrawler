import { coordKey, HEX_DIRECTIONS, type CubeCoord, type HexDirection } from "../engine/hex";
import type { Action, GameMode, GameState } from "../engine/state";
import { isPushableDirection } from "../engine/visibility";

export type KeydownResult =
  | { type: "none" }
  | { type: "toggle-journal" }
  | { type: "game-action"; action: Action; closeJournalFirst: boolean };

// Matches flat-top hexToPixel: W/S pure N/S; Q/E/A/D diagonals (see legend in renderer/legend.ts).
const KEY_TO_DIRECTION: Record<string, HexDirection> = {
  q: 3,
  w: 2,
  e: 1,
  a: 4,
  s: 5,
  d: 0,
};

export function keyToAction(key: string, mode: GameMode, state: GameState): Action | null {
  const normalized = key.toLowerCase();

  if (mode.type === "map") {
    if (normalized in KEY_TO_DIRECTION) {
      const direction = KEY_TO_DIRECTION[normalized];
      if (
        !isPushableDirection(
          state.player.hex,
          direction,
          state.player.hope,
          state.searing,
        )
      ) {
        return null;
      }
      return { type: "push", direction };
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

export function resolveKeydown(
  key: string,
  mode: GameMode,
  status: GameState["status"],
  journalOpen: boolean,
  state: GameState,
): KeydownResult {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === "j" && (status === "playing" || journalOpen)) {
    return { type: "toggle-journal" };
  }

  if (journalOpen && normalizedKey === "escape") {
    return { type: "toggle-journal" };
  }

  const action = keyToAction(key, mode, state);
  if (action) {
    return { type: "game-action", action, closeJournalFirst: journalOpen };
  }

  return { type: "none" };
}

export function clickedNeighborToAction(
  state: GameState,
  clicked: CubeCoord,
): Action | null {
  const center = state.player.hex;
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

  const hexDirection = direction as HexDirection;
  if (
    !isPushableDirection(
      center,
      hexDirection,
      state.player.hope,
      state.searing,
    )
  ) {
    return null;
  }

  return { type: "push", direction: hexDirection };
}
