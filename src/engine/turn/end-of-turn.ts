import { applyDelta } from "../resources";
import { getHopeDecayInterval } from "../relics";
import { advanceSearing, isConsumed, shouldAdvance } from "../searing";
import { checkPillarsOfFrost, checkRestartTheGear } from "../win";
import { type GameState } from "../state";
import { applyLossChecks } from "./checks";
import { appendLog, enterGameOver } from "./log";

function markConsumedTiles(state: GameState): GameState {
  const nextMap = new Map<string, (typeof state.map extends Map<string, infer T> ? T : never)>();
  for (const [key, tile] of state.map.entries()) {
    nextMap.set(
      key,
      tile.consumed || !isConsumed(tile.coord, state.searing)
        ? tile
        : { ...tile, consumed: true },
    );
  }

  return { ...state, map: nextMap };
}

function applyWinChecks(state: GameState): GameState {
  if (state.status !== "playing") {
    return state;
  }

  if (checkPillarsOfFrost(state.player.hex, state.searing)) {
    return enterGameOver(
      state,
      "win_pillars",
      "You stand before the Pillars of Frost, monuments to a world that was. The Searing is far behind. You are safe — for now.",
    );
  }

  if (checkRestartTheGear(state.relics)) {
    return enterGameOver(
      state,
      "win_gear",
      "The Gear turns. The mechanism groans to life. The sun shudders — and moves. You have restarted the world.",
    );
  }

  return state;
}

export function applyEndOfTurnEffects(state: GameState): GameState {
  let nextState = state;
  const hopeDecayInterval = getHopeDecayInterval(state.relics);

  if (nextState.turn > 0 && nextState.turn % hopeDecayInterval === 0) {
    nextState = {
      ...nextState,
      player: applyDelta(nextState.player, { hope: -1 }, nextState.relics),
    };
    nextState = appendLog(nextState, "The road wears at your resolve. (-1 Hope)", "resource");
  }

  if (shouldAdvance(nextState.turn, nextState.searing.advanceRate)) {
    nextState = {
      ...nextState,
      searing: advanceSearing(nextState.searing),
    };
    nextState = appendLog(nextState, "The Searing advances.", "searing");
    nextState = markConsumedTiles(nextState);
  }

  return applyWinChecks(applyLossChecks(nextState));
}
