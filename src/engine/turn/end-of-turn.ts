import { applyDelta } from "../resources";
import { getHopeDecayInterval } from "../relics";
import { advanceSearing, isConsumed, shouldAdvance } from "../searing";
import { type GameState } from "../state";
import { applyLossChecks } from "./checks";
import { appendLog } from "./log";

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

  return applyLossChecks(nextState);
}
